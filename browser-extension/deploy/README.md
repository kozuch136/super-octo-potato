# Wdrozenie bezobslugowe (zero klikniec ze strony pracownika)

Ten katalog zawiera gotowe szablony polityk, ktore razem daja pelne „bezobslugowe” dzialanie:
pracownik nie instaluje niczego recznie, nie wkleja zadnego adresu w Ustawieniach, samouczek po
prostu dziala od pierwszego uruchomienia przegladarki firmowej.

Sklada sie z dwoch niezaleznych mechanizmow, ktore trzeba wdrozyc razem:

1. **Wymuszona instalacja rozszerzenia** (`policy-extension-settings.json` + `update_manifest.xml`
   + spakowany `.crx`) — bez tego pracownik musialby sam wejsc w `chrome://extensions` i zaladowac
   folder recznie.
2. **Wymuszona konfiguracja synchronizacji** (`policy-managed-storage.google-admin.json`) — bez
   tego rozszerzenie by sie zainstalowalo, ale pracownik musialby recznie wkleic adres URL w
   Ustawieniach (co juz nie jest bezobslugowe).

## ID tego rozszerzenia

```
eamneljpkombhcofgdkmgehjnefhodko
```

To ID zostalo wyliczone deterministycznie z klucza publicznego (SHA-256 klucza -> pierwsze 16
bajtow -> zapis w alfabecie a-p) i **zweryfikowane empirycznie** — zapakowany `.crx` zaladowany w
prawdziwym Chromium w tym srodowisku dostal dokladnie to ID (`chrome-extension://eamnel.../`).
ID pozostanie takie samo dla kazdej kolejnej wersji, o ile aktualizacje sa podpisywane tym samym
kluczem prywatnym (patrz nizej).

## Pliki w tym katalogu

- `update_manifest.xml` — manifest aktualizacji, ktory Chrome odpytuje cyklicznie, zeby sprawdzic
  czy jest nowsza wersja. **Podmien `codebase` na prawdziwy adres**, pod ktorym bedzie dostepny
  plik `.crx`.
- `policy-extension-settings.json` — polityka Chrome (`ExtensionSettings`) wymuszajaca instalacje
  tego rozszerzenia u kazdego pracownika. **Podmien `update_url`** na adres, pod ktorym bedzie
  dostepny `update_manifest.xml`.
- `policy-managed-storage.google-admin.json` — konfiguracja wpychana do rozszerzenia (odczytywana
  przez `chrome.storage.managed`), ustawiajaca `syncUrl` na adres web triggera appki Forge (patrz
  panel admina w Jirze: **Ustawienia aplikacji → Ustawienia samouczka onboardingowego** → sekcja
  „Synchronizacja z rozszerzeniem przegladarki”). **Podmien `Value`** na ten adres.

Spakowany plik `jira-onboarding-guide.crx` **oraz klucz prywatny** `jira-onboarding-guide-
PRIVATE-KEY.pem` NIE sa w tym repozytorium (klucz prywatny nigdy nie powinien trafic do
kontroli wersji) — zostaly przekazane bezposrednio jako pliki do pobrania. Trzymaj `.pem` w
managerze sekretow / sejfie haseł firmy. **Utrata tego klucza = utrata mozliwosci wydawania
aktualizacji pod tym samym ID** (trzeba by bylo wdrozyc rozszerzenie od nowa, pod nowym ID, i
zaktualizowac wszystkie polityki).

## Co zrobic (jednorazowo)

1. Wystaw `jira-onboarding-guide.crx` i `update_manifest.xml` pod stabilnym adresem HTTPS,
   dostepnym z sieci firmowej (serwer wewnetrzny / intranet wystarczy, jesli pracownicy sa w
   VPN/biurze; nie musi byc publiczny).
2. Podmien placeholdery `ZASTAP-TO-SWOIM-ADRESEM` w `update_manifest.xml` i
   `policy-extension-settings.json` na te wlasnie adresy.
3. Podmien placeholder w `policy-managed-storage.google-admin.json` na adres web triggera appki
   Forge.
4. Wdroz obie polityki (patrz sekcja nizej wg tego, czym zarzadzasz przegladarkami).
5. Poczekaj — Chrome sam sprawdza i instaluje wymuszone rozszerzenia (zwykle przy nastepnym
   uruchomieniu przegladarki lub w ciagu kilku godzin), bez zadnej akcji pracownika.

## Gdzie wdrozyc polityki

**Google Workspace / Chrome Enterprise Core (Google Admin console):**
Devices → Chrome → Apps & extensions → Users & browsers → wybierz jednostke organizacyjna →
„+” → Add from a URL / ID → wklej ID `eamneljpkombhcofgdkmgehjnefhodko` → ustaw „Installation
policy: Force install” i w polu update URL wklej adres z `update_manifest.xml`. Dla managed
storage: ten sam ekran → „Policy for extensions” → wklej zawartosc
`policy-managed-storage.google-admin.json`.

**Windows bez Google Workspace (Group Policy / ADMX szablony Chrome):**
Polityka „Extension management settings” (klucz rejestru
`HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionSettings`) — wklej zawartosc
`policy-extension-settings.json` jako wartosc. Managed storage (3rd-party extension policy)
konfiguruje sie osobnym mechanizmem `3rdparty\extensions\<id>\policy\...` w rejestrze — sprawdz
aktualna dokumentacje Chrome Enterprise (`chrome://policy` po wdrozeniu pokaze, czy polityka
faktycznie dotarla).

**macOS (Jamf / Apple Business Manager / recznie .mobileconfig):**
Ten sam JSON co w Google Admin console wchodzi jako wartosc klucza `ExtensionSettings` w profilu
konfiguracyjnym domeny `com.google.Chrome`.

## Wydawanie aktualizacji w przyszlosci

1. Zmien kod w `browser-extension/`, podbij `"version"` w `browser-extension/manifest.json`.
2. Spakuj ponownie tym samym kluczem: `chromium --pack-extension=browser-extension
   --pack-extension-key=jira-onboarding-guide-PRIVATE-KEY.pem` (bez podania klucza Chrome
   wygenerowalby NOWY klucz i tym samym NOWE ID — pracownicy nie dostaliby aktualizacji, tylko
   osobna, nieskonfigurowana instalacje).
3. Zaktualizuj `version` w `update_manifest.xml` na ta sama wartosc.
4. Podmien plik `.crx` pod tym samym adresem `codebase`.
5. Chrome sam wykryje nowsza wersje przy kolejnym sprawdzeniu (domyslnie co ~5h) i zaktualizuje
   wszystkie zarzadzane instalacje bez udzialu pracownikow.

## Alternatywa: Chrome Web Store (prywatna publikacja)

Zamiast samodzielnie hostowac `.crx`/`update_manifest.xml`, mozna opublikowac rozszerzenie w
Chrome Web Store jako „prywatne” (widoczne tylko w Twojej domenie Google Workspace). Wtedy
`policy-extension-settings.json` wskazuje po prostu na ID ze Store (bez `update_url` — Chrome
aktualizuje automatycznie ze Store). Wymaga to jednorazowej rejestracji konta deweloperskiego
Google (oplata $5) i przejscia przez proces publikacji — czego nie moglem zrobic za Ciebie w tym
srodowisku (brak dostepu do Twojego konta Google/Chrome Web Store).

## Czego NIE zweryfikowano

Samo pakowanie `.crx` i wyliczenie ID zostalo przetestowane na zywo (patrz wyzej). Nie
zweryfikowano natomiast w tym srodowisku: faktycznego wdrozenia polityk `ExtensionSettings` /
managed storage przez prawdziwa konsole Google Admin / GPO / Jamf (brak dostepu do takiego
srodowiska zarzadzania), ani cyklu aktualizacji przez `update_manifest.xml` na prawdziwej flocie
przegladarek. Przed pelnym wdrozeniem przetestuj na jednej maszynie pilotazowej.
