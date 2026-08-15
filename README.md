# super-octo-potato — Onboarding dla nowych pracownikow w Jirze

Dwa alternatywne wdrozenia jednego pomyslu: prosty odpowiednik Digital Adoption Platform (jak
WalkMe) z szesciu przykladowymi samouczkami — piec dla pracownikow z licencja Jira (zakladanie
zgloszenia, praca z tablica, wyszukiwanie zgloszen, komentowanie i wspolpraca, zmiana statusu
workflow) oraz jeden dla portalu klienta JSM (jak poprawnie zglosic prosbe), z ktorego korzystaja
takze pracownicy bez licencji Jira. Wybierz podejscie zalezne od tego, czy wazniejsza jest
dystrybucja jako oficjalna appka Jiry, czy realne podswietlanie prawdziwych pol formularza na
kazdym z tych ekranow:

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

**Raport „kto sie zalogowal i co przeszedl”:** panel admina w Jirze (sekcja „Kto sie zalogowal i
co przeszedl”) pokazuje liste osob, ktore uruchomily ktorykolwiek samouczek — z panelu na
zgloszeniu (kazdy pracownik z licencja Jira, po koncie Jira, bez logowania), z panelu na portalu
klienta JSM (pracownicy bez licencji Jira, po koncie Jira) oraz z rozszerzenia przegladarki (tylko
gdy wlaczono w nim logowanie) — z osobna kolumna postepu dla kazdego z szesciu samouczkow. To sa
dane osobowe (imie, e-mail) — poinformuj pracownikow, ze postep jest sledzony.

## Forge app (glowny katalog)

Natywna aplikacja [Atlassian Forge](https://developer.atlassian.com/platform/forge/), ktora
wbudowuje w Jire prosty odpowiednik Digital Adoption Platform (np. WalkMe) skupiony na jednym
konkretnym problemie: nowi pracownicy nie wiedza, jak poprawnie zalozyc/uzupelnic ticket zgodnie
z procedura firmy.

## Co robi aplikacja

- **Panel na widoku zgloszenia** (`jira:issuePanel`) — przy pierwszym wejsciu uzytkownika
  uruchamia interaktywny samouczek typu "spotlight" dla pierwszego samouczka z `audience:
  'employee'` („Zakladanie zgloszenia”): krok po kroku podswietla kolejne pola (priorytet,
  komponent, opis, przypisanie...) i wyjasnia, jak je uzupelnic zgodnie z wewnetrzna procedura.
  Uzytkownik moze tez recznie uruchomic samouczek ponownie w dowolnym momencie. Pozostale
  samouczki dla pracownikow (tablica, wyszukiwanie, komentowanie, workflow) nie maja naturalnego
  miejsca w panelu Forge (dotycza innych ekranow niz widok zgloszenia) — dzialaja wylacznie w
  rozszerzeniu przegladarki, patrz nizej.
- **Panel na portalu klienta JSM** (`jiraServiceManagement:portalRequestCreatePropertyPanel`) —
  analogiczny panel na formularzu zgloszenia w portalu klienta, dla samouczka z `audience:
  'customer'` („Jak poprawnie zglosic prosbe”). Uzytkownicy tego portalu to zwykle pracownicy bez
  licencji Jira — panel dziala zawsze (bez wzgledu na to, czy maja rozszerzenie przegladarki), ale
  jesli maja je na firmowym komputerze, rozszerzenie dodatkowo realnie podswietla prawdziwe pola
  tego samego formularza (patrz `browser-extension/README.md`). Uzywa osobnej funkcji Forge
  (`portalResolver`) odizolowanej od panelu pracownikow — portal moze byc skonfigurowany z
  dostepem anonimowym, wiec traktujemy go jako inna granice zaufania.
- **Strona administracyjna** (`jira:adminPage`, tylko dla adminow Jiry) — administrator definiuje
  tresc wszystkich samouczkow (tytul + kroki, kazdy krok to naglowek + opis, oraz pole „Odbiorcy”
  wybierajace `employee`/`customer`) tak, aby odzwierciedlaly realna procedure firmy, bez zmian w
  kodzie, oraz widzi zbiorczy raport kto co ukonczyl.
- **„Moj postep” w ustawieniach osobistych** (`jira:personalSettingsPage`) — kazdy pracownik z
  licencja Jira moze sam sprawdzic swoj wlasny postep w kazdym z samouczkow (w panelu Jiry i/lub w
  rozszerzeniu przegladarki, jesli z niego korzysta) bez czekania na admina.
- **Stan per uzytkownik i per samouczek** — Forge Storage API zapamietuje, czy dany uzytkownik
  (`accountId`) juz widzial dany samouczek, wiec kazdy pojawia sie automatycznie tylko raz.
- **Pole `audience` samouczka** wybiera tylko, ktory natywny panel Forge pokazuje dany samouczek
  domyslnie (panel na zgloszeniu vs. panel na portalu klienta) — **nie** filtruje tego, co
  otrzymuje rozszerzenie przegladarki przez synchronizacje: rozszerzenie zawsze dostaje wszystkie
  samouczki i samo wykrywa, na ktorym ekranie jest uzytkownik, po selektorach CSS w krokach.

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
manifest.yml                     — definicja modulow Forge (panel, portal, admin, "moj postep", web triggery)
src/tours.js                     — wspolny model danych: lista samouczkow (kazdy z polem audience), kazdy ze swoimi krokami
src/identity.js                  — wspolna weryfikacja tokenow logowania (Microsoft/Atlassian)
src/jiraUser.js                  — wspolny helper: pobranie imienia/e-maila uzytkownika Jiry po accountId
src/resolvers/panel.js           — backend dla jira:issuePanel + jira:personalSettingsPage
src/resolvers/portal.js          — backend WYLACZNIE dla portalu klienta JSM (osobna funkcja Forge, inna granica zaufania)
src/resolvers/admin.js           — backend WYLACZNIE dla jira:adminPage (osobna funkcja Forge)
src/webTrigger.js                — publiczny endpoint HTTP: synchronizacja wszystkich samouczkow z rozszerzeniem
src/atlassianOAuth.js            — wymiana kodu OAuth Atlassian na token (trzyma client_secret)
src/onboardingReport.js          — endpoint: rozszerzenie zglasza logowanie/postep
static/onboarding-panel/         — Custom UI: panel z samouczkiem na zgloszeniu (React + @atlaskit/onboarding)
static/portal-request-panel/     — Custom UI: analogiczny panel na formularzu portalu klienta JSM
static/admin-page/               — Custom UI: edytor tresci samouczkow + raport zbiorczy (React)
static/my-progress/              — Custom UI: wlasny postep pracownika (React)
```

## Uruchomienie lokalne / wdrozenie

Wymagany [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/) oraz konto
deweloperskie Atlassian.

```bash
npm install -g @forge/cli
forge login

npm run install:all   # instaluje zaleznosci wszystkich frontendow (static/*)
npm run build          # buduje wszystkie frontendy do static/*/build

forge deploy
forge install          # podpiecie appki do wybranej instancji Jira Cloud
```

Do iteracyjnej pracy nad frontendem mozna uzyc `forge tunnel` zamiast `forge deploy`.

## Konfiguracja tresci samouczkow

Po instalacji appki w Jirze: **Ustawienia aplikacji → Ustawienia samouczka onboardingowego**
(strona admina dodana przez te appke). Tam mozna dodawac/usuwac cale samouczki, ustawiac ich
odbiorcow (`employee` / `customer`), a w kazdym z nich dodawac, usuwac, zmieniac kolejnosc i
edytowac tresc poszczegolnych krokow — zmiany sa widoczne natychmiast w panelu na widoku
zgloszenia (pierwszy samouczek dla `employee`) i w panelu na portalu klienta (pierwszy samouczek
dla `customer`), a po najblizszej synchronizacji takze w rozszerzeniu przegladarki (wszystkie
samouczki, bez wzgledu na odbiorce).

## Wlasny postep pracownika

Kazdy pracownik moze sam sprawdzic swoj postep bez pytania admina: strona „Moj postep w
onboardingu” (`jira:personalSettingsPage`) w ustawieniach osobistych Jiry (klik na awatar w
prawym gornym rogu → ustawienia osobiste — dokladna nazwa/miejsce w menu zalezy od wersji Jira
Cloud, **nie zweryfikowane na zywo** w tym srodowisku). Pokazuje osobna karte z paskiem postepu dla kazdego
samouczka, ktory pracownik zaczal — osobno dla panelu w Jirze i (jesli uzywane) dla rozszerzenia
przegladarki. Resolver
(`getMyProgress` w `src/resolvers/panel.js`) zwraca wylacznie dane wywolujacego uzytkownika —
`accountId` pochodzi z kontekstu Forge, nie z zadnego parametru, wiec nie da sie tym resolverem
podejrzec cudzego postepu.

## Jedno zrodlo prawdy: synchronizacja Forge → rozszerzenie

Zamiast konfigurowac te same samouczki osobno w appce Forge i osobno w rozszerzeniu przegladarki,
mozna skonfigurowac je **raz**, w panelu admina Jiry, i podpiac rozszerzenie pod ten sam zestaw:

1. Wdroz appke (`forge deploy` + `forge install`) — dopiero po instalacji Forge generuje adres
   web triggera.
2. W Jirze otworz **Ustawienia aplikacji → Ustawienia samouczka onboardingowego**. Na gorze
   strony jest sekcja „Synchronizacja z rozszerzeniem przegladarki” z gotowym adresem URL i
   przyciskiem „Kopiuj”.
3. W kazdym kroku kazdego samouczka dodaj tez **Selektor CSS** (pole widoczne pod naglowkiem
   „Identyfikator pola”) — to jedyna czesc konfiguracji, ktorej uzywa wylacznie rozszerzenie
   (wskazuje prawdziwe pole na stronie Jiry do podswietlenia). Panel Forge to pole ignoruje (uzywa
   go tylko dla pierwszego samouczka, i to po `id`, nie po `selector`).
4. Wklej skopiowany adres w rozszerzeniu: **Ustawienia rozszerzenia → Synchronizacja z aplikacja
   Forge → wklej adres → „Zapisz adres” → „Synchronizuj teraz”**.
5. Od tej pory rozszerzenie samo odswieza wszystkie samouczki w tle co ~6h (`chrome.alarms`), a
   kazda zmiana zapisana w panelu Forge trafia do rozszerzenia po najblizszej synchronizacji (albo
   od razu po recznym kliknieciu „Synchronizuj teraz”). Rozszerzenie samo wykrywa, na ktorym
   ekranie jest uzytkownik i automatycznie uruchamia wlasciwy samouczek (patrz
   `browser-extension/README.md`).

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
