import { storage } from '@forge/api';

export const TOURS_KEY = 'onboarding-tours';

// Kazdy samouczek to lista krokow {id, selector, heading, description}.
// `selector` jest uzywany tylko przez rozszerzenie przegladarki
// (podswietlenie prawdziwego pola na danej stronie Jiry); panel Forge
// pokazuje wylacznie pierwszy samouczek dla pracownikow (`ticket-creation`)
// i ignoruje `selector` (podswietla wlasna makiete po `id` - patrz
// static/onboarding-panel/src/App.jsx). Samouczki #2-5 nie maja naturalnego
// miejsca w panelu Forge (dotycza innych ekranow niz widok zgloszenia,
// ktorych Forge Custom UI nie widzi - patrz README) - dzialaja tylko w
// rozszerzeniu przegladarki.
//
// `audience` mowi, ktory NATYWNY panel Forge (mock-spotlight) ma pokazac
// dany samouczek jako pierwszy/domyslny - nie decyduje o tym, czy trafia do
// rozszerzenia przegladarki (rozszerzenie dostaje WSZYSTKIE samouczki,
// niezaleznie od audience, i samo wykrywa na ktorej stronie jest uzytkownik):
// - "employee" (domyslne, jesli brak pola) - panel na widoku zgloszenia
//   (jira:issuePanel) pokazuje pierwszy samouczek z tym audience.
// - "customer" - panel na portalu klienta JSM
//   (jiraServiceManagement:portalRequestCreatePropertyPanel, patrz
//   static/portal-request-panel/) pokazuje samouczki z tym audience.
//   Typowo uzytkownicy portalu to pracownicy BEZ licencji Jira (obsluga
//   wewnetrznych zgloszen jako "klienci" service desk, np. do HR/IT) - maja
//   firmowe komputery z tym samym rozszerzeniem, wiec ono tez dziala na
//   portalu (podswietla prawdziwe pola formularza requestu), nie tylko
//   panel Forge z makieta.
//
// Firma podmienia tresc (w tym selektory) w panelu admina zgodnie z
// wlasna procedura i rzeczywista struktura swojej instancji Jiry.
export const DEFAULT_TOURS = [
  {
    id: 'ticket-creation',
    title: 'Zakladanie zgloszenia',
    description: 'Jak poprawnie wypelnic nowy ticket zgodnie z procedura firmy.',
    audience: 'employee',
    steps: [
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
    ],
  },
  {
    id: 'board-navigation',
    title: 'Praca z tablica (Kanban/Scrum)',
    description: 'Jak czytac tablice i poprawnie przenosic zgloszenia miedzy statusami.',
    audience: 'employee',
    steps: [
      {
        id: 'board-columns',
        selector: '[data-testid*="board"] [data-testid*="column"], .ghx-column',
        heading: 'Kolumny tablicy',
        description:
          'Kazda kolumna to status zgloszenia. Zanim przeniesiesz karte, upewnij sie, ze spelniasz warunki wyjscia z biezacej kolumny (np. kod po code review).',
      },
      {
        id: 'board-card',
        selector: '[data-testid*="board"] [data-testid*="card"], .ghx-issue',
        heading: 'Karta zgloszenia',
        description:
          'Kliknij karte, zeby zobaczyc szczegoly. Przeciagnij ja do nastepnej kolumny, gdy zmieniasz status pracy.',
      },
      {
        id: 'board-swimlane',
        selector: '[data-testid*="swimlane"], .ghx-swimlane-header',
        heading: 'Swimlane',
        description:
          'Swimlane grupuje zgloszenia (np. wg epika lub osoby przypisanej) - uzyj ich, zeby szybciej znalezc swoje zadania.',
      },
    ],
  },
  {
    id: 'search-filtering',
    title: 'Wyszukiwanie i filtrowanie zgloszen',
    description: 'Jak znalezc swoje zadania i zapisac przydatne filtry.',
    audience: 'employee',
    steps: [
      {
        id: 'search-bar',
        selector: '[data-testid*="global-search"] input, #quickSearchInput',
        heading: 'Szybkie wyszukiwanie',
        description:
          'Wpisz numer zgloszenia (np. PROJ-123) albo fragment tytulu, zeby szybko je znalezc.',
      },
      {
        id: 'search-jql',
        selector: '[data-testid*="jql-editor"], #jql-basic-mode',
        heading: 'Wyszukiwanie zaawansowane (JQL)',
        description:
          'Uzyj filtra "assignee = currentUser() AND status != Done", zeby zobaczyc swoje otwarte zadania.',
      },
      {
        id: 'search-save-filter',
        selector: '[data-testid*="save-filter-button"], #issue-filter-save',
        heading: 'Zapisywanie filtra',
        description:
          'Zapisz czesto uzywane wyszukiwanie jako filtr, zeby nie wpisywac go za kazdym razem od nowa.',
      },
    ],
  },
  {
    id: 'commenting',
    title: 'Komentowanie i wspolpraca',
    description: 'Jak poprawnie komunikowac sie w zgloszeniu.',
    audience: 'employee',
    steps: [
      {
        id: 'comment-box',
        selector: '[data-testid*="comment"] .ProseMirror, #comment',
        heading: 'Dodawanie komentarza',
        description:
          'Pisz komentarze rzeczowo - co sprawdziles, co zauwazyles, jaki jest nastepny krok.',
      },
      {
        id: 'comment-mention',
        selector: '[data-testid*="mention"], .mentions-input',
        heading: 'Oznaczanie osob (@wzmianki)',
        description:
          'Wpisz "@" i imie osoby, ktora powinna zobaczyc komentarz - dostanie powiadomienie.',
      },
      {
        id: 'comment-attachment',
        selector: '[data-testid*="attachment"] input[type="file"], #file-uploader',
        heading: 'Zalaczniki',
        description:
          'Dolacz zrzut ekranu albo log, zeby przyspieszyc diagnoze problemu.',
      },
    ],
  },
  {
    id: 'workflow-transitions',
    title: 'Zmiana statusu zgloszenia (workflow)',
    description: 'Kiedy i jak przechodzic miedzy statusami zgodnie z procesem firmy.',
    audience: 'employee',
    steps: [
      {
        id: 'workflow-status-button',
        selector: '[data-testid*="status-field"] button, #status-val',
        heading: 'Przycisk statusu',
        description:
          'Kliknij biezacy status, zeby zobaczyc dostepne przejscia (np. "Do zrobienia" -> "W trakcie").',
      },
      {
        id: 'workflow-transition-screen',
        selector: '[data-testid*="transition-screen"], .transition-dialog',
        heading: 'Ekran przejscia',
        description:
          'Niektore przejscia wymagaja dodatkowych informacji (np. przyczyny odrzucenia) - uzupelnij je przed zatwierdzeniem.',
      },
    ],
  },
  {
    id: 'portal-request',
    title: 'Zgloszenie prosby przez portal klienta',
    description:
      'Jak poprawnie wypelnic formularz zgloszenia na portalu klienta (Jira Service Management).',
    audience: 'customer',
    steps: [
      {
        id: 'portal-request-type',
        selector: '[data-testid*="request-type"], [data-testid*="practice-selector"]',
        heading: 'Typ zgloszenia',
        description:
          'Wybierz typ najlepiej pasujacy do Twojej prosby - to przyspiesza jej obsluge i kierowanie do wlasciwego zespolu.',
      },
      {
        id: 'portal-summary',
        selector: '[data-testid*="summary"] input, #summary',
        heading: 'Podsumowanie',
        description: 'Opisz krotko, jednym zdaniem, czego dotyczy zgloszenie.',
      },
      {
        id: 'portal-description',
        selector: '[data-testid*="description"] .ProseMirror, #description',
        heading: 'Szczegoly',
        description:
          'Podaj jak najwiecej szczegolow: co sie stalo, kiedy, jakie kroki juz probowales - to skraca czas obslugi.',
      },
      {
        id: 'portal-attachment',
        selector: '[data-testid*="attachment"] input[type="file"], #file-uploader',
        heading: 'Zalaczniki',
        description: 'Dodaj zrzut ekranu lub plik, jesli to pomoze zespolowi zrozumiec problem.',
      },
    ],
  },
];

export async function getTours() {
  const tours = await storage.get(TOURS_KEY);
  return tours ?? DEFAULT_TOURS;
}

export async function setTours(tours) {
  await storage.set(TOURS_KEY, tours);
}

// `tourId` z zadania klienta (panel Jiry, rozszerzenie) trafia jako klucz
// obiektu w src/resolvers/panel.js i src/onboardingReport.js
// (`tours[tourId] = ...`). Bez tej ochrony wartosc "__proto__" (albo
// "constructor"/"prototype") pozwolilaby dopisac wlasnosc bezposrednio do
// Object.prototype (zanieczyszczenie prototypu) zamiast do zwyklego klucza
// mapy. Uzycie tego bylo w praktyce niegrozne w tym repo (nic nie odczytuje
// tych pol z "nagiego" obiektu), ale koszt zabezpieczenia jest zerowy.
export function isDangerousObjectKey(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
