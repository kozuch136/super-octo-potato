import Resolver from '@forge/resolver';
import { storage, webTrigger } from '@forge/api';
import { getSteps, setSteps } from '../steps.js';

const seenKey = (accountId) => `onboarding-seen-${accountId}`;

const resolver = new Resolver();

resolver.define('getOnboardingSteps', async () => {
  return getSteps();
});

resolver.define('saveOnboardingSteps', async (req) => {
  const { steps } = req.payload;
  if (!Array.isArray(steps)) {
    throw new Error('steps musi byc tablica');
  }
  await setSteps(steps);
  return { ok: true };
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

// URL, pod ktorym rozszerzenie przegladarki moze pobrac aktualne kroki
// (patrz src/webTrigger.js) - wyswietlany w panelu admina do skopiowania
// do ustawien rozszerzenia.
resolver.define('getSyncInfo', async () => {
  const url = await webTrigger.getUrl('onboarding-steps-webtrigger');
  return { url };
});

export const handler = resolver.getDefinitions();
