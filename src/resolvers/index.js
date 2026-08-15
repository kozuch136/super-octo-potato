import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const STEPS_KEY = 'onboarding-steps';
const seenKey = (accountId) => `onboarding-seen-${accountId}`;

// Domyslna sciezka onboardingu - firma podmienia tresc w panelu admina
// zgodnie z wlasna procedura zakladania zgloszen.
const DEFAULT_STEPS = [
  {
    id: 'summary',
    heading: 'Tytul zgloszenia',
    description:
      'Napisz zwiezly, konkretny tytul - unikaj ogolnikow typu "Problem z systemem".',
  },
  {
    id: 'priority',
    heading: 'Priorytet',
    description:
      'Ustaw priorytet zgodnie z SLA: "Highest" tylko dla awarii produkcyjnych.',
  },
  {
    id: 'component',
    heading: 'Komponent',
    description:
      'Wskaz komponent/modul, ktorego dotyczy zgloszenie - to kieruje ticket do wlasciwego zespolu.',
  },
  {
    id: 'description',
    heading: 'Opis',
    description:
      'Skorzystaj z szablonu: Kroki reprodukcji, Oczekiwany rezultat, Rzeczywisty rezultat.',
  },
  {
    id: 'assignee',
    heading: 'Przypisanie',
    description:
      'Nie przypisuj ticketu recznie - zostaw puste, zespol sam podejmie go z kolejki.',
  },
];

const resolver = new Resolver();

resolver.define('getOnboardingSteps', async () => {
  const steps = await storage.get(STEPS_KEY);
  return steps ?? DEFAULT_STEPS;
});

resolver.define('saveOnboardingSteps', async (req) => {
  const { steps } = req.payload;
  if (!Array.isArray(steps)) {
    throw new Error('steps musi byc tablica');
  }
  await storage.set(STEPS_KEY, steps);
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

export const handler = resolver.getDefinitions();
