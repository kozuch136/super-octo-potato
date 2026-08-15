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

// Adresy, pod ktorymi rozszerzenie przegladarki laczy sie z appka Forge -
// wyswietlane w panelu admina do skopiowania do ustawien rozszerzenia:
// `url` do synchronizacji krokow (src/webTrigger.js), `atlassianOAuthExchangeUrl`
// do logowania Atlassian, jesli admin skonfiguruje logowanie
// (src/atlassianOAuth.js, patrz browser-extension/auth/README.md).
resolver.define('getSyncInfo', async () => {
  const [url, atlassianOAuthExchangeUrl] = await Promise.all([
    webTrigger.getUrl('onboarding-steps-webtrigger'),
    webTrigger.getUrl('atlassian-oauth-exchange'),
  ]);
  return { url, atlassianOAuthExchangeUrl };
});

export const handler = resolver.getDefinitions();
