import Resolver from '@forge/resolver';
import { storage, requestJira, route, startsWith } from '@forge/api';
import { getSteps } from '../steps.js';

// Resolver uzywany WYLACZNIE przez panel na widoku zgloszenia oraz stronie
// "Moj postep" w ustawieniach osobistych (jira:issuePanel,
// jira:personalSettingsPage - obie sa "zwyklym" kontekstem pracownika, wiec
// bezpiecznie dziela ten sam backend). Operacje administracyjne (zapis
// krokow, zbiorczy raport wszystkich osob) sa na osobnej funkcji
// (src/resolvers/admin.js) i nie sa stad osiagalne, nawet gdyby ktos
// probowal wywolac je recznie z mostka jednego z tych dwoch modulow.

const seenKey = (accountId) => `onboarding-seen-${accountId}`;
const reportKey = (accountId) => `report:panel:jira:${accountId}`;

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
    const profile = await fetchUserProfile(accountId);
    name = profile.name;
    email = profile.email;
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

// Widok "Moj postep" (jira:personalSettingsPage) - kazdy pracownik widzi
// WYLACZNIE swoje wlasne dane (accountId pochodzi z kontekstu Forge, nie z
// payloadu, wiec nie da sie podejrzec cudzego postepu przez ten resolver).
// Laczy dwa zrodla:
// 1. Panel Jiry - bezposredni odczyt po tym samym accountId.
// 2. Rozszerzenie przegladarki, zalogowane przez Atlassian - `account_id`
//    zwracany przez api.atlassian.com/me to TEN SAM globalny identyfikator
//    Atlassiana co accountId w Jirze, wiec to tez bezposredni odczyt.
//    Zalogowane przez Microsoft - nie ma wspolnego identyfikatora z Jira,
//    wiec dopasowujemy po adresie e-mail (ograniczone przeszukanie po
//    prefiksie, tylko wsrod wpisow microsoft).
resolver.define('getMyProgress', async (req) => {
  const { accountId } = req.context;

  const [steps, panel, atlassianExtension] = await Promise.all([
    getSteps(),
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
    totalSteps: steps.length,
    stepHeadings: Object.fromEntries(steps.map((s) => [s.id, s.heading])),
    panel: panel || null,
    extension: atlassianExtension || microsoftExtension || null,
  };
});

export const handler = resolver.getDefinitions();
