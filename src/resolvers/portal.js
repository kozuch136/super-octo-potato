import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import { getTours, isDangerousObjectKey } from '../tours.js';
import { fetchUserProfile } from '../jiraUser.js';

// Resolver uzywany WYLACZNIE przez panel na portalu klienta JSM
// (jiraServiceManagement:portalRequestCreatePropertyPanel). Odbiorcami sa
// zwykle pracownicy BEZ licencji Jira, obslugujacy wewnetrzne zgloszenia
// (np. do HR/IT) jako "klienci" service desk - to wciaz pracownicy firmy,
// ale portal moze byc tez skonfigurowany jako dostepny anonimowo (zalezy od
// ustawien projektu JSM), wiec kazda funkcja tutaj musi to obslugiwac
// (brak accountId = brak sledzenia stanu, samouczek pokazuje sie za kazdym
// razem). To CELOWO osobna funkcja Forge od panelResolver/adminResolver -
// portal to inna, nizsza granica zaufania (moze byc dostepny bez
// standardowego logowania Jira), wiec nie dzieli backendu z reszta appki.

const seenKey = (accountId, tourId) => `onboarding-seen-portal-${accountId}-${tourId}`;
const reportKey = (accountId) => `report:portal:jira:${accountId}`;

function emptyTourProgress() {
  return { completedStepIds: [], tourOutcome: null, tourCompletedAt: null };
}

const resolver = new Resolver();

// Zwraca WYLACZNIE samouczki oznaczone jako przeznaczone na portal klienta
// (audience: 'customer') - panel portalu nie pokazuje tresci/selektorow
// samouczkow przeznaczonych do widoku zgloszenia.
resolver.define('getPortalTours', async () => {
  const tours = await getTours();
  return tours.filter((t) => t.audience === 'customer');
});

resolver.define('getPortalOnboardingState', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  if (!accountId || !tourId) {
    return { seen: false }; // brak zalogowania - pokazuj za kazdym razem
  }
  const seen = await storage.get(seenKey(accountId, tourId));
  return { seen: Boolean(seen) };
});

resolver.define('markPortalOnboardingSeen', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  if (!accountId || !tourId) {
    return { ok: false };
  }
  await storage.set(seenKey(accountId, tourId), true);
  return { ok: true };
});

resolver.define('resetPortalOnboardingState', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  if (!accountId || !tourId) {
    return { ok: false };
  }
  await storage.delete(seenKey(accountId, tourId));
  return { ok: true };
});

resolver.define('recordPortalStepSeen', async (req) => {
  const { accountId } = req.context;
  const { tourId, stepId } = req.payload || {};
  if (!accountId || !tourId || !stepId || isDangerousObjectKey(tourId)) {
    return { ok: false };
  }

  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'portal',
    provider: 'jira',
    firstSeenAt: Date.now(),
    tours: {},
  };

  let { name, email } = existing;
  if (!name) {
    const profile = await fetchUserProfile(accountId);
    name = profile.name;
    email = profile.email;
  }

  const tours = { ...(existing.tours || {}) };
  const tourProgress = tours[tourId] || emptyTourProgress();
  tourProgress.completedStepIds = Array.from(
    new Set([...(tourProgress.completedStepIds || []), stepId])
  );
  tours[tourId] = tourProgress;

  await storage.set(key, { ...existing, name, email, tours, lastActivityAt: Date.now() });
  return { ok: true };
});

resolver.define('recordPortalTourFinished', async (req) => {
  const { accountId } = req.context;
  const { tourId, outcome } = req.payload || {}; // outcome: 'completed' | 'skipped'
  if (!accountId || !tourId || isDangerousObjectKey(tourId)) {
    return { ok: false };
  }
  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'portal',
    provider: 'jira',
    firstSeenAt: Date.now(),
    tours: {},
  };
  const tours = { ...(existing.tours || {}) };
  const tourProgress = tours[tourId] || emptyTourProgress();
  tourProgress.tourCompletedAt = Date.now();
  tourProgress.tourOutcome = outcome || 'completed';
  tours[tourId] = tourProgress;

  await storage.set(key, { ...existing, tours, lastActivityAt: Date.now() });
  return { ok: true };
});

export const handler = resolver.getDefinitions();
