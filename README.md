# super-octo-potato — Onboarding dla nowych pracownikow w Jirze

Natywna aplikacja [Atlassian Forge](https://developer.atlassian.com/platform/forge/), ktora
wbudowuje w Jire prosty odpowiednik Digital Adoption Platform (np. WalkMe) skupiony na jednym
konkretnym problemie: nowi pracownicy nie wiedza, jak poprawnie zalozyc/uzupelnic ticket zgodnie
z procedura firmy.

## Co robi aplikacja

- **Panel na widoku zgloszenia** (`jira:issuePanel`) — przy pierwszym wejsciu uzytkownika
  uruchamia interaktywny samouczek typu "spotlight": krok po kroku podswietla kolejne pola
  (priorytet, komponent, opis, przypisanie...) i wyjasnia, jak je uzupelnic zgodnie z wewnetrzna
  procedura. Uzytkownik moze tez recznie uruchomic samouczek ponownie w dowolnym momencie.
- **Strona administracyjna** (`jira:globalPage`) — administrator Jiry definiuje tresc kazdego
  kroku (naglowek + opis) tak, aby odzwierciedlala realna procedure firmy, bez zmian w kodzie.
- **Stan per uzytkownik** — Forge Storage API zapamietuje, czy dany uzytkownik (`accountId`) juz
  widzial samouczek, wiec pojawia sie automatycznie tylko raz.

## Ograniczenie architektoniczne (wazne)

Aplikacje Forge Custom UI renderuja sie w odizolowanym iframe (panel na widoku zgloszenia /
osobna strona) i nie maja dostepu do DOM natywnego formularza Jiry poza swoim obszarem. Dlatego
panel prezentuje wlasna, uproszczona makiete pol ticketu i po niej prowadzi spotlight-tour —
zamiast probowac (niewspierane) nakladanie dymkow bezposrednio na natywny formularz tworzenia
zgloszenia. To wciaz w pelni "natywne w Jirze" rozwiazanie (dystrybuowane jako appka Forge, bez
rozszerzenia przegladarki), ale tresc krokow trzeba dopasowac tak, by uczyla wlasciwych nawykow,
a nie klikala za uzytkownika w prawdziwe pola.

## Struktura repo

```
manifest.yml                     — definicja modulow Forge (panel + strona admina)
src/resolvers/index.js           — backend: CRUD na krokach + stan "widziano" per uzytkownik
static/onboarding-panel/         — Custom UI: panel z samouczkiem (React + @atlaskit/onboarding)
static/admin-page/               — Custom UI: edytor tresci krokow (React)
```

## Uruchomienie lokalne / wdrozenie

Wymagany [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) oraz konto
deweloperskie Atlassian.

```bash
npm install -g @forge/cli
forge login

npm run install:all   # instaluje zaleznosci obu frontendow (static/*)
npm run build          # buduje oba frontendy do static/*/build

forge deploy
forge install          # podpiecie appki do wybranej instancji Jira Cloud
```

Do iteracyjnej pracy nad frontendem mozna uzyc `forge tunnel` zamiast `forge deploy`.

## Konfiguracja tresci samouczka

Po instalacji appki w Jirze: **Ustawienia aplikacji → Ustawienia samouczka onboardingowego**
(strona globalna dodana przez te appke). Tam mozna dodawac, usuwac, zmieniac kolejnosc i edytowac
tresc poszczegolnych krokow — zmiany sa widoczne natychmiast we wszystkich panelach na widokach
zgloszen.
