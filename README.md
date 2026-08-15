# super-octo-potato — Onboarding dla nowych pracownikow w Jirze

Dwa alternatywne wdrozenia jednego pomyslu: prosty odpowiednik Digital Adoption Platform (jak
WalkMe) skupiony na konkretnym problemie — nowi pracownicy nie wiedza, jak poprawnie
zalozyc/uzupelnic ticket zgodnie z procedura firmy. Wybierz podejscie zalezne od tego, czy
wazniejsza jest dystrybucja jako oficjalna appka Jiry, czy realne podswietlanie prawdziwych pol
formularza:

| | [`/` (Forge app)](#forge-app-glowny-katalog) | [`browser-extension/`](browser-extension/README.md) |
|---|---|---|
| Instalacja | appka Jira (Atlassian Marketplace / instalacja prywatna) | rozszerzenie Chrome (per uzytkownik lub przez Chrome Enterprise) |
| Co podswietla | wlasna makieta pol w panelu bocznym | **prawdziwe** pola natywnego formularza Jiry |
| Wymaga | konto deweloperskie Atlassian, `forge deploy` | wgranie folderu w trybie dewelopera / polityke MDM |
| Ograniczenie | nie dotyka realnego DOM formularza (izolacja iframe) | zalezy od (niepublikowanej) struktury DOM Jiry — selektory trzeba weryfikowac |

Ponizej opisana jest wersja Forge. Wersja rozszerzenia ma wlasny opis w
[`browser-extension/README.md`](browser-extension/README.md).

**Jedna konfiguracja dla obu:** appka Forge udostepnia kroki tez jako publiczny endpoint
(web trigger). Rozszerzenie przegladarki moze sie z niego automatycznie synchronizowac, wiec
tresc samouczka wystarczy skonfigurowac raz — w panelu admina Jiry. Zobacz sekcje
[„Jedno zrodlo prawdy: synchronizacja Forge → rozszerzenie”](#jedno-zrodlo-prawdy-synchronizacja-forge--rozszerzenie)
nizej.

**Zero akcji ze strony pracownika:** polaczenie powyzszej synchronizacji z centralnym wymuszeniem
instalacji rozszerzenia (`browser-extension/deploy/`) daje pelnie bezobslugowe wdrozenie — appka
Forge jest jedynym miejscem, w ktorym ktokolwiek recznie edytuje tresc samouczka; pracownik
dostaje dzialajace rozszerzenie i samouczek bez klikania czegokolwiek.

**Opcjonalne logowanie (Microsoft / Atlassian):** rozszerzenie moze tez wymagac zalogowania sie
przed uruchomieniem samouczka i uzywac tokenu z tego logowania do zabezpieczenia synchronizacji z
Forge (zamiast polegac tylko na tajnosci adresu URL) — patrz
[`browser-extension/auth/README.md`](browser-extension/auth/README.md).

## Forge app (glowny katalog)

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
manifest.yml                     — definicja modulow Forge (panel + strona admina + web trigger)
src/steps.js                     — wspolny model danych krokow (uzywany przez resolver i web trigger)
src/resolvers/index.js           — backend: CRUD na krokach + stan "widziano" per uzytkownik
src/webTrigger.js                — publiczny endpoint HTTP odczytywany przez rozszerzenie przegladarki
static/onboarding-panel/         — Custom UI: panel z samouczkiem (React + @atlaskit/onboarding)
static/admin-page/               — Custom UI: edytor tresci krokow + panel synchronizacji (React)
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

## Jedno zrodlo prawdy: synchronizacja Forge → rozszerzenie

Zamiast konfigurowac te same kroki osobno w appce Forge i osobno w rozszerzeniu przegladarki,
mozna skonfigurowac je **raz**, w panelu admina Jiry, i podpiac rozszerzenie pod ten sam zestaw:

1. Wdroz appke (`forge deploy` + `forge install`) — dopiero po instalacji Forge generuje adres
   web triggera.
2. W Jirze otworz **Ustawienia aplikacji → Ustawienia samouczka onboardingowego**. Na gorze
   strony jest sekcja „Synchronizacja z rozszerzeniem przegladarki” z gotowym adresem URL i
   przyciskiem „Kopiuj”.
3. W kazdym stepie dodaj tez **Selektor CSS** (pole widoczne pod naglowkiem „Identyfikator
   pola”) — to jedyna czesc konfiguracji, ktorej uzywa wylacznie rozszerzenie (wskazuje
   prawdziwe pole na stronie Jiry do podswietlenia). Panel Forge to pole ignoruje.
4. Wklej skopiowany adres w rozszerzeniu: **Ustawienia rozszerzenia → Synchronizacja z aplikacja
   Forge → wklej adres → „Zapisz adres” → „Synchronizuj teraz”**.
5. Od tej pory rozszerzenie samo odswieza kroki w tle co ~6h (`chrome.alarms`), a kazda zmiana
   zapisana w panelu Forge trafia do rozszerzenia po najblizszej synchronizacji (albo od razu po
   recznym kliknieciu „Synchronizuj teraz”).

**Dystrybucja w calej organizacji bez konfiguracji per uzytkownik:** jesli IT wdraza rozszerzenie
centralnie przez Chrome Enterprise policy, wystarczy w polityce ustawic `syncUrl` na ten sam adres
web triggera (schemat: `browser-extension/managed_schema.json`) — kazda instalacja rozszerzenia
zsynchronizuje sie automatycznie przy starcie, bez koniecznosci klikania czegokolwiek przez
pracownikow.

**Opcjonalne zabezpieczenie endpointu:** domyslnie adres web triggera jest publiczny (chroniony
tylko dlugoscia/losowoscia URL-a wygenerowanego przez Forge) i udostepnia wylacznie tresc
samouczka (nazwy pol, podpowiedzi tekstowe) — nic wrazliwego. Jesli to za malo, ustaw
`forge variables set --encrypt SYNC_TOKEN <sekret>` — wtedy endpoint zacznie wymagac parametru
`?token=<sekret>` (dopisz go recznie do adresu wklejanego w rozszerzeniu).

**Nieprzetestowane w tym srodowisku:** web trigger nie zostal wywolany na zywo (brak konta
Atlassian w tym srodowisku), wiec dokladny format wygenerowanego adresu (domena
`*.atlassian-dev.net` czy inna, w zaleznosci od regionu/trybu wdrozenia) nie zostal zweryfikowany
empirycznie — kod jest zgodny z udokumentowanym API Forge (`webTrigger.getUrl`,
ksztalt request/response handlera), ale przed poleganiem na tym w produkcji przetestuj cala
sciezke raz recznie.
