import { storage } from '@forge/api';

export const STEPS_KEY = 'onboarding-steps';

// Domyslna sciezka onboardingu - firma podmienia tresc w panelu admina
// zgodnie z wlasna procedura zakladania zgloszen. `selector` jest uzywany
// tylko przez rozszerzenie przegladarki (podswietlenie prawdziwego pola);
// panel Forge ignoruje to pole i podswietla wlasna makiete po `id`.
export const DEFAULT_STEPS = [
  {
    id: 'summary',
    selector: '[data-testid*="summary"] input, #summary',
    heading: 'Tytul zgloszenia',
    description:
      'Napisz zwiezly, konkretny tytul - unikaj ogolnikow typu "Problem z systemem".',
  },
  {
    id: 'priority',
    selector: '[data-testid*="priority-field"], #priority-field',
    heading: 'Priorytet',
    description:
      'Ustaw priorytet zgodnie z SLA: "Highest" tylko dla awarii produkcyjnych.',
  },
  {
    id: 'component',
    selector: '[data-testid*="components-field"], #components-field',
    heading: 'Komponent',
    description:
      'Wskaz komponent/modul, ktorego dotyczy zgloszenie - to kieruje ticket do wlasciwego zespolu.',
  },
  {
    id: 'description',
    selector: '[data-testid*="description"] .ProseMirror, #description',
    heading: 'Opis',
    description:
      'Skorzystaj z szablonu: Kroki reprodukcji, Oczekiwany rezultat, Rzeczywisty rezultat.',
  },
  {
    id: 'assignee',
    selector: '[data-testid*="assignee-field"], #assignee-field',
    heading: 'Przypisanie',
    description:
      'Nie przypisuj ticketu recznie - zostaw puste, zespol sam podejmie go z kolejki.',
  },
];

export async function getSteps() {
  const steps = await storage.get(STEPS_KEY);
  return steps ?? DEFAULT_STEPS;
}

export async function setSteps(steps) {
  await storage.set(STEPS_KEY, steps);
}
