# Jira Onboarding Guide — rozszerzenie przegladarki

To jest wariant rozwiazania z prawdziwym nakladaniem dymkow (spotlight) na **natywny** formularz
Jiry — czego apka Forge (`../manifest.yml`, `../static/*`) nie moze zrobic, bo dziala w
odizolowanym iframe bez dostepu do DOM strony. Rozszerzenie przegladarki dziala jako content
script wstrzykniety bezposrednio na strone `*.atlassian.net`, wiec moze podswietlac prawdziwe
pola na dowolnym ekranie Jiry — nie tylko przy zakladaniu zgloszenia (jak apka Forge), ale tez
na tablicy, w wyszukiwarce, przy komentowaniu czy zmianie statusu, a takze na **portalu klienta
JSM** (ten sam content script dziala na tej samej domenie `*.atlassian.net`). Domyslnie
skonfigurowane jest szesc przykladowych samouczkow (patrz `background.js` i panel admina appki
Forge), kazdy dla innego ekranu — piec dla pracownikow z licencja Jira i jeden dla portalu
klienta (pole `audience: 'customer'` w `src/tours.js`), z ktorego korzystaja m.in. pracownicy bez
licencji Jira na firmowych komputerach. Rozszerzenie nie rozroznia samouczkow po `audience` —
zawsze pobiera je wszystkie i samo wykrywa, ktory pasuje do biezacej strony po selektorach.

Manifest V3, przetestowane pod katem Chrome/Chromium (Edge, Brave itd. dzialaja tak samo — silnik
Chromium). Do Firefoksa wymagalby dodania `browser_specific_settings.gecko.id` oraz fallbacku
`background.scripts` — patrz komentarz w wyniku `web-ext lint` opisany nizej.

## Instalacja lokalna (tryb dewelopera)

1. Otworz `chrome://extensions`.
2. Wlacz „Tryb dewelopera” (Developer mode) w prawym gornym rogu.
3. Kliknij „Zaladuj rozpakowane” (Load unpacked) i wskaz katalog `browser-extension/`.
4. Otworz dowolna strone w swojej instancji Jira Cloud (`https://twojafirma.atlassian.net/...`).

Rozszerzenie samo wykrywa, na ktorym ekranie jest uzytkownik: przy kazdej wizycie sprawdza
rownolegle wszystkie jeszcze nieobejrzane samouczki (krotki, ograniczony czasowo test, czy
pierwsze pole danego samouczka istnieje na biezacej stronie) i automatycznie uruchamia pierwszy
pasujacy. W kazdej chwili mozna tez recznie wybrac dowolny samouczek — klik na pluszowy przycisk
„?” w prawym dolnym rogu strony otwiera liste wszystkich samouczkow (szare = prawdopodobnie
niedostepny na tej stronie, ale mozna i tak sprobowac), albo z poziomu ikony rozszerzenia w pasku
narzedzi.

## Konfiguracja samouczkow — dwie opcje

**Opcja A (zalecana): synchronizacja z appka Forge.** Jesli w tym samym repo masz wdrozona appke
Forge (glowny katalog), skonfiguruj wszystkie samouczki raz w Jirze (**Ustawienia aplikacji →
Ustawienia samouczka onboardingowego**) i podepnij pod nia rozszerzenie: **Ustawienia rozszerzenia
→ Synchronizacja z aplikacja Forge → wklej adres z panelu Forge → „Zapisz adres” →
„Synchronizuj teraz”**. Od tej pory oba miejsca pokazuja te sama tresc, a rozszerzenie odswieza ja
samo co ~6h. Pelny opis w
[`../README.md#jedno-zrodlo-prawdy-synchronizacja-forge--rozszerzenie`](../README.md#jedno-zrodlo-prawdy-synchronizacja-forge--rozszerzenie).

**Opcja B: konfiguracja lokalna.** Bez appki Forge mozna edytowac samouczki bezposrednio w
Ustawieniach rozszerzenia. Kazdy samouczek to `{ id, title, description, steps: [...] }`, gdzie
kazdy krok to `{ id, selector, heading, description }`. `selector` to zwykly selektor CSS
wskazujacy pole na stronie Jiry, ktore ma zostac podswietlone.

**Wazne zastrzezenie:** Atlassian nie publikuje ani nie gwarantuje stabilnego, publicznego DOM
Jiry Cloud. Przykladowe samouczki w `src/tours.js` (katalog glowny repo, skad rozszerzenie moze
je zsynchronizowac) uzywaja przykladowych atrybutow `data-testid`, ktore sa najbardziej odpornym
dostepnym punktem zaczepienia, ale **moga sie zmienic** przy aktualizacji Jiry i nie sa przeze
mnie zweryfikowane na zywej instancji (brak dostepu do takiej w tym srodowisku). Przed uzyciem
produkcyjnym zweryfikuj/ustaw je na nowo narzedziem opisanym nizej — dla kazdego z szesciu
samouczkow osobno, bo dotycza roznych ekranow (tworzenie zgloszenia, tablica, wyszukiwanie,
komentarze, workflow, formularz na portalu klienta).

### Tryb „Zaznacz element” (zalecany)

1. Otworz Ustawienia rozszerzenia (przycisk „Ustawienia samouczkow” w popupie, albo
   `chrome://extensions` → szczegoly → „Opcje rozszerzenia”).
2. Rozwin samouczek, ktorego krok chcesz poprawic, i kliknij przy nim „Zaznacz element”.
3. Przelacz sie na karte z otwarta Jira, na ekranie, ktorego dotyczy ten samouczek (np. tablica
   dla samouczka „Praca z tablica”) — musi byc juz otwarta w tym samym oknie — strona podswietli
   element pod kursorem na czerwono.
4. Kliknij pole, ktore ma byc podswietlane w tym kroku (Esc anuluje).
5. Selektor zostanie automatycznie wpisany w formularzu ustawien. Kliknij „Zapisz”.

Dzieki temu nie trzeba znac ani zgadywac wewnetrznej struktury DOM Jiry — narzedzie samo
generuje selektor (preferujac `data-testid`, potem `id`, potem sciezke po drzewie DOM).

## Dystrybucja w organizacji

Dla pojedynczych uzytkownikow: eksport/import JSON w Ustawieniach (przyciski „Eksportuj JSON” /
„Importuj JSON”) pozwala rozeslac gotowy zestaw samouczkow zespolowi jako plik.

Dla calej organizacji (Chrome Enterprise / Google Workspace): rozszerzenie odczytuje
`chrome.storage.managed`, ktorego schemat jest w `managed_schema.json`. IT moze wdrozyc
rozszerzenie centralnie wraz z polityka `ExtensionSettings` ustawiajaca `tours` (lub `syncUrl`,
patrz nizej) — wtedy strona Ustawien pokazuje samouczki jako tylko-do-odczytu (nie da sie ich
nadpisac lokalnie), co gwarantuje spojna tresc dla wszystkich pracownikow.

### Pelne wdrozenie bezobslugowe (zero akcji ze strony pracownika)

Instrukcje powyzej (instalacja recznie w trybie dewelopera, wklejanie adresu synchronizacji w
Ustawieniach) sa dobre do testowania, ale wymagaja akcji uzytkownika. Zeby pracownik nie musial
klikac NIC — rozszerzenie samo sie instaluje i samo sie konfiguruje przy pierwszym uruchomieniu
przegladarki — zobacz gotowe szablony polityk w [`deploy/`](deploy/README.md): wymuszona
instalacja (`ExtensionSettings` + spakowany `.crx`) polaczona z centralnie wdrozonym `syncUrl`
(`chrome.storage.managed`) wskazujacym na appke Forge. ID tego rozszerzenia
(`eamneljpkombhcofgdkmgehjnefhodko`) zostalo juz wyliczone i zweryfikowane empirycznie w tym
repozytorium — szczegoly w `deploy/README.md`.

## Logowanie (opcjonalne) — Microsoft Entra ID / Atlassian

Domyslnie rozszerzenie dziala bez logowania. Mozna to zmienic — patrz
[`auth/README.md`](auth/README.md) — zeby: (1) samouczki uruchamialy sie dopiero po zalogowaniu
pracownika, (2) synchronizacja z Forge byla zabezpieczona prawdziwym tokenem OAuth zamiast
polegac wylacznie na tajnosci adresu URL, oraz (3) w panelu admina Jiry bylo widac, kto sie
zalogowal i ktore samouczki oraz ktore ich kroki przeszedl. Dziala to z Microsoft Entra ID (Azure
AD) i/lub kontem Atlassian, konfigurowane niezaleznie w Ustawieniach rozszerzenia (sekcja
„Logowanie”) — mozna wlaczyc jeden dostawca, oba, lub zaden.

## Domena Jiry inna niz *.atlassian.net

`manifest.json` (`host_permissions` i `content_scripts.matches`) jest ograniczony do
`*://*.atlassian.net/*` (Jira Cloud). Dla self-hosted Jira Data Center pod wlasna domena trzeba
podmienic ten wzorzec na wlasciwy adres (np. `*://jira.twojafirma.com/*`) przed spakowaniem
rozszerzenia dla organizacji.

## Weryfikacja tego katalogu

Manifest zostal sprawdzony `npx web-ext lint` (walidacja skladni/schematu) — jedyne pozostale
ostrzezenia/bledy dotycza wymogow specyficznych dla Firefoksa (`browser_specific_settings`),
nieistotnych dla celu Chrome/Chromium tego rozszerzenia. Wszystkie pliki `.js` przeszly
`node --check` i bundlowanie esbuild (rozwiazywanie importow). Caly kod rozszerzenia — wlacznie
z wielosamouczkowym `content/content.js` (rownolegle wykrywanie dostepnego samouczka, menu
wyboru) — zostal zaladowany w prawdziwym, headless Chromium: service worker startuje bez
bledow, `options.html` i `popup.html` renderuja sie bez wyjatkow JS w konsoli (sprawdzone przez
CDP `Runtime.exceptionThrown` / `Runtime.consoleAPICalled`). Rozszerzenie **nie bylo uruchamiane
na zywej instancji Jira** w tym srodowisku (brak dostepu do takiej instancji) — logika
wykrywania samouczkow i dzialanie selektorow na prawdziwym DOM Jiry nie zostaly zweryfikowane
empirycznie. Przed uzyciem produkcyjnym przetestuj kazdy samouczek recznie i zweryfikuj
selektory narzedziem „Zaznacz element”.
