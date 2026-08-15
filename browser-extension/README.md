# Jira Onboarding Guide — rozszerzenie przegladarki

To jest wariant rozwiazania z prawdziwym nakladaniem dymkow (spotlight) na **natywny** formularz
Jiry — czego apka Forge (`../manifest.yml`, `../static/*`) nie moze zrobic, bo dziala w
odizolowanym iframe bez dostepu do DOM strony. Rozszerzenie przegladarki dziala jako content
script wstrzykniety bezposrednio na strone `*.atlassian.net`, wiec moze podswietlac prawdziwe
pola formularza (Priorytet, Komponent, Opis, ...), a nie ich makiete.

Manifest V3, przetestowane pod katem Chrome/Chromium (Edge, Brave itd. dzialaja tak samo — silnik
Chromium). Do Firefoksa wymagalby dodania `browser_specific_settings.gecko.id` oraz fallbacku
`background.scripts` — patrz komentarz w wyniku `web-ext lint` opisany nizej.

## Instalacja lokalna (tryb dewelopera)

1. Otworz `chrome://extensions`.
2. Wlacz „Tryb dewelopera” (Developer mode) w prawym gornym rogu.
3. Kliknij „Zaladuj rozpakowane” (Load unpacked) i wskaz katalog `browser-extension/`.
4. Otworz dowolny ticket lub formularz zakladania zgloszenia w swojej instancji Jira Cloud
   (`https://twojafirma.atlassian.net/...`).

Przy pierwszej wizycie samouczek uruchomi sie automatycznie, gdy tylko na stronie pojawi sie
pole pasujace do pierwszego skonfigurowanego kroku. W kazdej chwili mozna go tez wywolac
recznie — klikajac ikone rozszerzenia (przycisk „Uruchom ponownie samouczek”) albo pluszowy
przycisk „?” w prawym dolnym rogu strony.

## Konfiguracja krokow — dwie opcje

**Opcja A (zalecana): synchronizacja z appka Forge.** Jesli w tym samym repo masz wdrozona appke
Forge (glowny katalog), skonfiguruj kroki raz w Jirze (**Ustawienia aplikacji → Ustawienia
samouczka onboardingowego**) i podepnij pod nia rozszerzenie: **Ustawienia rozszerzenia →
Synchronizacja z aplikacja Forge → wklej adres z panelu Forge → „Zapisz adres” → „Synchronizuj
teraz”**. Od tej pory oba miejsca pokazuja te sama tresc, a rozszerzenie odswieza ja samo co ~6h.
Pelny opis w [`../README.md#jedno-zrodlo-prawdy-synchronizacja-forge--rozszerzenie`](../README.md#jedno-zrodlo-prawdy-synchronizacja-forge--rozszerzenie).

**Opcja B: konfiguracja lokalna.** Bez appki Forge mozna edytowac kroki bezposrednio w
Ustawieniach rozszerzenia. Kazdy krok to `{ id, selector, heading, description }`. `selector` to
zwykly selektor CSS wskazujacy pole na stronie Jiry, ktore ma zostac podswietlone.

**Wazne zastrzezenie:** Atlassian nie publikuje ani nie gwarantuje stabilnego, publicznego DOM
Jiry Cloud. Domyslne kroki w `background.js` uzywaja przykladowych atrybutow `data-testid`,
ktore sa najbardziej odpornym dostepnym punktem zaczepienia, ale **moga sie zmienic** przy
aktualizacji Jiry i nie sa przeze mnie zweryfikowane na zywej instancji (brak dostepu do takiej
w tym srodowisku). Przed uzyciem produkcyjnym zweryfikuj/ustaw je na nowo narzedziem opisanym
nizej.

### Tryb „Zaznacz element” (zalecany)

1. Otworz Ustawienia rozszerzenia (przycisk „Ustawienia krokow” w popupie, albo
   `chrome://extensions` → szczegoly → „Opcje rozszerzenia”).
2. Przy danym kroku kliknij „Zaznacz element”.
3. Przelacz sie na karte z otwarta Jira (musi byc juz otwarta w tym samym oknie) — strona
   podswietli element pod kursorem na czerwono.
4. Kliknij pole, ktore ma byc podswietlane w tym kroku (Esc anuluje).
5. Selektor zostanie automatycznie wpisany w formularzu ustawien. Kliknij „Zapisz”.

Dzieki temu nie trzeba znac ani zgadywac wewnetrznej struktury DOM Jiry — narzedzie samo
generuje selektor (preferujac `data-testid`, potem `id`, potem sciezke po drzewie DOM).

## Dystrybucja w organizacji

Dla pojedynczych uzytkownikow: eksport/import JSON w Ustawieniach (przyciski „Eksportuj JSON” /
„Importuj JSON”) pozwala rozeslac gotowy zestaw krokow zespolowi jako plik.

Dla calej organizacji (Chrome Enterprise / Google Workspace): rozszerzenie odczytuje
`chrome.storage.managed`, ktorego schemat jest w `managed_schema.json`. IT moze wdrozyc
rozszerzenie centralnie wraz z polityka `ExtensionSettings` ustawiajaca `steps` (lub `syncUrl`,
patrz nizej) — wtedy strona Ustawien pokazuje kroki jako tylko-do-odczytu (nie da sie ich
nadpisac lokalnie), co gwarantuje spojna tresc samouczka dla wszystkich pracownikow.

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
[`auth/README.md`](auth/README.md) — zeby: (1) samouczek uruchamial sie dopiero po zalogowaniu
pracownika, oraz (2) synchronizacja z Forge byla zabezpieczona prawdziwym tokenem OAuth zamiast
polegac wylacznie na tajnosci adresu URL. Dziala to z Microsoft Entra ID (Azure AD) i/lub kontem
Atlassian, konfigurowane niezaleznie w Ustawieniach rozszerzenia (sekcja „Logowanie”) — mozna
wlaczyc jeden dostawca, oba, lub zaden.

## Domena Jiry inna niz *.atlassian.net

`manifest.json` (`host_permissions` i `content_scripts.matches`) jest ograniczony do
`*://*.atlassian.net/*` (Jira Cloud). Dla self-hosted Jira Data Center pod wlasna domena trzeba
podmienic ten wzorzec na wlasciwy adres (np. `*://jira.twojafirma.com/*`) przed spakowaniem
rozszerzenia dla organizacji.

## Weryfikacja tego katalogu

Manifest zostal sprawdzony `npx web-ext lint` (walidacja skladni/schematu) — jedyne pozostale
ostrzezenia/bledy dotycza wymogow specyficznych dla Firefoksa (`browser_specific_settings`),
nieistotnych dla celu Chrome/Chromium tego rozszerzenia. Wszystkie pliki `.js` przeszly
`node --check`. Rozszerzenie **nie bylo uruchamiane na zywej instancji Jira** w tym srodowisku
(brak dostepu do przegladarki z zaladowanym rozszerzeniem + realnej Jiry) — przed uzyciem
produkcyjnym przetestuj samouczek recznie i zweryfikuj selektory narzedziem „Zaznacz element”.
