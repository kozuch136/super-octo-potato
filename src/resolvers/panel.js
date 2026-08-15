import Resolver from '@forge/resolver';
import { storage, requestJira, route, startsWith } from '@forge/api';
import { getTours } from '../tours.js';

// Resolver uzywany WYLACZNIE przez panel na widoku zgloszenia oraz stronie
// "Moj postep" w ustawieniach osobistych (jira:issuePanel,
// jira:personalSettingsPage - obie sa "zwyklym" kontekstem pracownika, wiec
// bezpiecznie dziela ten sam backend). Operacje administracyjne (zapis
// samouczkow, zbiorczy raport wszystkich osob) sa na osobnej funkcji
// (src/resolvers/admin.js) i nie sa stad osiagalne, nawet gdyby ktos
// probowal wywolac je recznie z mostka jednego z tych dwoch modulow.
//
// Panel Forge (jira:issuePanel) pokazuje wylacznie pierwszy samouczek
// ("ticket-creation") - to jedyny, ktory ma naturalne miejsce na widoku
// zgloszenia. Pozostale samouczki (tablica, wyszukiwanie, komentowanie,
// workflow) dzialaja tylko w rozszerzeniu przegladarki (patrz
// browser-extension/content/content.js), ale ich postep i tak trafia do
// tego samego raportu, wiec strona "Moj postep" pokazuje je wszystkie.

const seenKey = (accountId, tourId) => `onboarding-seen-${accountId}-${tourId}`;
const reportKey = (accountId) => `report:panel:jira:${accountId}`;

function emptyTourProgress() {
  return { completedStepIds: [], tourOutcome: null, tourCompletedAt: null };
}

const resolver = new Resolver();

async function fetchUserProfile(accountId) {
  try {
    const response = await requestJira(route`/rest/api/3/user?accountId=${accountId}`);
    if (response.ok) {
      const user = await response.json();
      return { name: user.displayName || null, email: user.emailAddress || null };
    }
  } catch (err) {
    // brak profilu nie jest krytyczny - wywolujacy pokaze accountId zamiast nazwy
  }
  return { name: null, email: null };
}

resolver.define('getOnboardingTours', async () => {
  return getTours();
});

resolver.define('getOnboardingState', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  const seen = await storage.get(seenKey(accountId, tourId));
  return { seen: Boolean(seen) };
});

resolver.define('markOnboardingSeen', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  await storage.set(seenKey(accountId, tourId), true);
  return { ok: true };
});

resolver.define('resetOnboardingState', async (req) => {
  const { accountId } = req.context;
  const { tourId } = req.payload || {};
  await storage.delete(seenKey(accountId, tourId));
  return { ok: true };
});

// Zapisuje postep krok-po-kroku do raportu widocznego w panelu admina
// (przy pierwszym wywolaniu doklada tez wyswietlana nazwe/e-mail
// uzytkownika pobrane z Jiry - "as app", wiec nie wymaga dodatkowej zgody
// uzytkownika, ale wymaga scope'u read:jira-user w manifest.yml).
resolver.define('recordStepSeen', async (req) => {
  const { accountId } = req.context;
  const { tourId, stepId } = req.payload || {};
  if (!tourId || !stepId) {
    return { ok: false };
  }

  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'jira-panel',
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

  await storage.set(key, {
    ...existing,
    name,
    email,
    tours,
    lastActivityAt: Date.now(),
  });
  return { ok: true };
});

resolver.define('recordTourFinished', async (req) => {
  const { accountId } = req.context;
  const { tourId, outcome } = req.payload || {}; // outcome: 'completed' | 'skipped'
  if (!tourId) {
    return { ok: false };
  }
  const key = reportKey(accountId);
  const existing = (await storage.get(key)) || {
    source: 'jira-panel',
    provider: 'jira',
    firstSeenAt: Date.now(),
    tours: {},
  };
  const tours = { ...(existing.tours || {}) };
  const tourProgress = tours[tourId] || emptyTourProgress();
  tourProgress.tourCompletedAt = Date.now();
  tourProgress.tourOutcome = outcome || 'completed';
  tours[tourId] = tourProgress;

  await storage.set(key, {
    ...existing,
    tours,
    lastActivityAt: Date.now(),
  });
  return { ok: true };
});

// Widok "Moj postep" (jira:personalSettingsPage) - kazdy pracownik widzi
// WYLACZNIE swoje wlasne dane (accountId pochodzi z kontekstu Forge, nie z
// payloadu, wiec nie da sie podejrzec cudzego postepu przez ten resolver).
// Laczy dwa zrodla, po jednym rekordzie kazde (z zagniezdzonym postepem per
// samouczek):
// 1. Panel Jiry - bezposredni odczyt po tym samym accountId.
// 2. Rozszerzenie przegladarki, zalogowane przez Atlassian - `account_id`
//    zwracany przez api.atlassian.com/me to TEN SAM globalny identyfikator
//    Atlassiana co accountId w Jirze, wiec to tez bezposredni odczyt.
//    Zalogowane przez Microsoft - nie ma wspolnego identyfikatora z Jira,
//    wiec dopasowujemy po adresie e-mail (ograniczone przeszukanie po
//    prefiksie, tylko wsrod wpisow microsoft).
resolver.define('getMyProgress', async (req) => {
  const { accountId } = req.context;

  const [tours, panel, atlassianExtension] = await Promise.all([
    getTours(),
    storage.get(reportKey(accountId)),
    storage.get(`report:extension:atlassian:${accountId}`),
  ]);

  let microsoftExtension = null;
  if (!atlassianExtension) {
    const myEmail = panel?.email || (await fetchUserProfile(accountId)).email;
    if (myEmail) {
      try {
        let cursor;
        for (let page = 0; page < 5 && !microsoftExtension; page += 1) {
          let query = storage
            .query()
            .where('key', startsWith('report:extension:microsoft:'))
            .limit(50);
          if (cursor) {
            query = query.cursor(cursor);
          }
          const result = await query.getMany();
          const match = result.results.find((r) => r.value.email === myEmail);
          if (match) {
            microsoftExtension = match.value;
          }
          if (!result.nextCursor) {
            break;
          }
          cursor = result.nextCursor;
        }
      } catch (err) {
        // brak dopasowania nie jest krytyczne - po prostu nie pokazemy tej sekcji
      }
    }
  }

  return {
    tours: tours.map((t) => ({ id: t.id, title: t.title, totalSteps: t.steps.length })),
    panel: panel || null,
    extension: atlassianExtension || microsoftExtension || null,
  };
});

export const handler = resolver.getDefinitions();
