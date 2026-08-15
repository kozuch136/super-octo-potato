import Resolver from '@forge/resolver';
import { storage, requestJira, route } from '@forge/api';
import { getSteps } from '../steps.js';

// Resolver uzywany WYLACZNIE przez panel na widoku zgloszenia
// (jira:issuePanel, patrz manifest.yml -> resolver: {function: panelResolver}).
// Rejestrujemy tu tylko funkcje, ktore kazdy pracownik moze legalnie
// wywolac - operacje administracyjne (zapis krokow, raport) sa na osobnej
// funkcji (src/resolvers/admin.js) i nie sa stad osiagalne, nawet gdyby
// ktos probowal wywolac je recznie z mostka tego panelu.

const seenKey = (accountId) => `onboarding-seen-${accountId}`;
const reportKey = (accountId) => `report:panel:jira:${accountId}`;

const resolver = new Resolver();

resolver.define('getOnboardingSteps', async () => {
  return getSteps();
});

resolver.define('getOnboardingState', async (req) => {
  const { accountId } = req.context;
  const seen = await storage.get(seenKey(accountId));
  return { seen: Boolean(seen) };
});

resolver.define('markOnboardingSeen', async (req) => {
  const { accountId } = req.context;
  await storage.set(seenKey(accountId), true);
  return { ok: true };
});

resolver.define('resetOnboardingState', async (req) => {
  const { accountId } = req.context;
  await storage.delete(seenKey(accountId));
  return { ok: true };
});

// Zapisuje postep krok-po-kroku do raportu widocznego w panelu admina
// (przy pierwszym wywolaniu doklada tez wyswietlana nazwe/e-mail
// uzytkownika pobrane z Jiry - "as app", wiec nie wymaga dodatkowej zgody
// uzytkownika, ale wymaga scope'u read:jira-user w manifest.yml).
resolver.define('recordStepSeen', async (req) => {
  const { accountId } = req.context;
  const { stepId } = req.payload || {};
  if (!stepId) {
    return { ok: false };
  }

  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'jira-panel',
    provider: 'jira',
    firstSeenAt: Date.now(),
    completedStepIds: [],
    tourCompletedAt: null,
    tourOutcome: null,
  };

  let { name, email } = existing;
  if (!name) {
    try {
      const response = await requestJira(route`/rest/api/3/user?accountId=${accountId}`);
      if (response.ok) {
        const user = await response.json();
        name = user.displayName || null;
        email = user.emailAddress || null;
      }
    } catch (err) {
      // brak nazwy nie blokuje dzialania samouczka - raport pokaze samo accountId
    }
  }

  const merged = {
    ...existing,
    name,
    email,
    completedStepIds: Array.from(new Set([...(existing.completedStepIds || []), stepId])),
    lastActivityAt: Date.now(),
  };
  await storage.set(key, merged);
  return { ok: true };
});

resolver.define('recordTourFinished', async (req) => {
  const { accountId } = req.context;
  const { outcome } = req.payload || {}; // 'completed' | 'skipped'
  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'jira-panel',
    provider: 'jira',
    firstSeenAt: Date.now(),
    completedStepIds: [],
  };
  await storage.set(key, {
    ...existing,
    tourCompletedAt: Date.now(),
    tourOutcome: outcome || 'completed',
    lastActivityAt: Date.now(),
  });
  return { ok: true };
});

export const handler = resolver.getDefinitions();
