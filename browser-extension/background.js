const DEFAULT_STEPS = [
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

// Selektory powyzej sa PRZYKLADEM opartym o typowe atrybuty data-testid
// Jiry Cloud. Atlassian nie gwarantuje stabilnosci tych atrybutow miedzy
// wydaniami, wiec przed produkcyjnym uzyciem zweryfikuj/ustaw je na nowo
// narzedziem "Zaznacz element" w Ustawieniach.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') {
    return;
  }
  const existing = await chrome.storage.local.get('steps');
  if (!existing.steps) {
    await chrome.storage.local.set({ steps: DEFAULT_STEPS });
  }
});
