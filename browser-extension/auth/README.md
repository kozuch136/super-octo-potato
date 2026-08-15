# Logowanie w rozszerzeniu (Microsoft Entra ID / Atlassian)

Logowanie jest **opcjonalne** i wylacza sie samo, dopoki nie skonfigurujesz przynajmniej jednego
dostawcy (patrz Ustawienia rozszerzenia -> sekcja „Logowanie”). Bez konfiguracji rozszerzenie
dziala dokladnie tak jak wczesniej - bez zadnego logowania.

Po skonfigurowaniu logowanie robi dwie rzeczy naraz:
1. **Brama dostepu** - samouczki na stronie Jiry (`content/content.js`) nie uruchomia sie, dopoki
   pracownik sie nie zaloguje. Widac to po ikonie w prawym dolnym rogu strony: `?` = mozna
   otworzyc liste samouczkow, `🔒` = trzeba sie najpierw zalogowac (klik otwiera popup
   rozszerzenia).
2. **Zabezpieczenie synchronizacji** - token uzyskany przy logowaniu jest dolaczany jako
   `Authorization: Bearer <token>` do zapytania synchronizujacego samouczki z Forge
   (`background.js` -> `syncFromForge`). Appka Forge (`../../src/webTrigger.js`) go weryfikuje.
3. **Raport „kto sie zalogowal / co przeszedl”** - po zalogowaniu i przy kazdym kroku kazdego
   samouczka rozszerzenie zglasza zdarzenie (z `tourId` i `stepId`) do appki Forge
   (`background.js` -> `reportEvent`, endpoint `../../src/onboardingReport.js`), ktora zapisuje
   imie/e-mail (wyciagniete z tokenu) oraz postep osobno dla kazdego samouczka. Widac to w panelu
   admina Jiry, sekcja „Kto sie zalogowal i co przeszedl” (osobna kolumna na kazdy z pieciu
   samouczkow) - wymaga skonfigurowania trzeciego adresu, „Adres raportowania”, w Ustawieniach
   rozszerzenia (patrz nizej).

## Jak to dziala technicznie

`chrome.identity.launchWebAuthFlow()` (wymaga uprawnienia `identity` w manifescie, juz dodane)
otwiera okno logowania dostawcy i lapie przekierowanie na
`https://<ID-rozszerzenia>.chromiumapp.org/`. Dla tego, juz spakowanego rozszerzenia, ID to:

```
eamneljpkombhcofgdkmgehjnefhodko
```

wiec redirect URI do zarejestrowania u obu dostawcow to:

```
https://eamneljpkombhcofgdkmgehjnefhodko.chromiumapp.org/
```

(jesli kiedys przepakujesz rozszerzenie INNYM kluczem prywatnym niz ten wygenerowany wczesniej -
patrz `../deploy/README.md` - ID, a wiec i ten adres, sie zmieni; musialbys zaktualizowac
rejestracje aplikacji u obu dostawcow).

Obie sciezki logowania uzywaja PKCE (RFC 7636, `auth/pkce.js`) - rozszerzenie samo generuje
losowy `code_verifier`, wysyla tylko jego skrot (`code_challenge`), a przy wymianie kodu na token
podaje oryginalny `code_verifier`. To standardowy sposob na bezpieczne OAuth dla aplikacji, ktore
nie moga trzymac sekretu (SPA, aplikacje mobilne, rozszerzenia przegladarki).

### Microsoft Entra ID (Azure AD) - `auth/microsoft.js`

Cala wymiana kodu na token dzieje sie **bezposrednio w rozszerzeniu** (bez posrednictwa Forge) -
Microsoft oficjalnie wspiera "public client" PKCE bez client_secret.

1. [Microsoft Entra admin center](https://entra.microsoft.com) -> App registrations -> New
   registration.
2. Nazwa dowolna (np. "Jira Onboarding Guide"). "Supported account types": zwykle "Accounts in
   this organizational directory only" (Twoj tenant).
3. Authentication -> Add a platform -> **Mobile and desktop applications** -> w polu custom
   redirect URI wklej adres z gory (`https://eamneljpkombhcofgdkmgehjnefhodko.chromiumapp.org/`).
4. Tamze: **Allow public client flows** -> Yes (bez tego wymiana kodu bez client_secret zostanie
   odrzucona).
5. API permissions: domyslne `User.Read` (Microsoft Graph, delegated) wystarczy - logujemy tylko
   tozsamosc, nie czytamy nic wiecej.
6. Skopiuj **Application (client) ID** oraz **Directory (tenant) ID** z zakladki Overview.
7. W Ustawieniach rozszerzenia (sekcja „Logowanie”) wklej oba te ID w pola Microsoft. Mozna tez
   wdrozyc centralnie przez `chrome.storage.managed` (`msClientId`, `msTenantId` w
   `managed_schema.json`), tak samo jak `syncUrl`.

### Atlassian OAuth 2.0 (3LO) - `auth/atlassian.js` + `../../src/atlassianOAuth.js`

Tutaj wymiana kodu na token **NIE** dzieje sie w rozszerzeniu - idzie przez appke Forge, bo
aplikacje OAuth Atlassiana zwykle maja client_secret, ktorego rozszerzenie nie moze bezpiecznie
przechowac (kazdy moze rozpakowac `.crx` i go odczytac). Rozszerzenie robi tylko czesc publiczna
(ekran logowania + PKCE), a `code` przekazuje do Forge, ktora dokleja sekret i konczy wymiane.

1. [developer.atlassian.com](https://developer.atlassian.com/console/myapps/) -> Create -> OAuth
   2.0 integration.
2. Authorization -> dodaj redirect URI: `https://eamneljpkombhcofgdkmgehjnefhodko.chromiumapp.org/`.
3. Permissions: nie sa potrzebne zadne scope'y do Jira/Confluence API - logujemy tylko tozsamosc
   (`read:me`).
4. Skopiuj **Client ID** i **Secret** z zakladki Settings.
5. Sekret **nigdy** nie trafia do rozszerzenia ani do repo. Ustaw go jako zaszyfrowana zmienna
   Forge:
   ```bash
   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_ID <client id>
   forge variables set --encrypt ATLASSIAN_OAUTH_CLIENT_SECRET <client secret>
   forge deploy
   ```
6. Adres wymiany tokenu to web trigger appki Forge (`atlassian-oauth-exchange`, patrz
   `manifest.yml` w katalogu glownym) - po `forge deploy` znajdziesz go w Jirze, w tym samym
   panelu co adres synchronizacji: **Ustawienia aplikacji → Ustawienia samouczka onboardingowego**
   → sekcja „Synchronizacja z rozszerzeniem przegladarki” → pole „Adres wymiany tokenu logowania
   Atlassian”.
7. W Ustawieniach rozszerzenia wklej **Client ID** (jawny, nie sekret) oraz ten adres wymiany w
   pola Atlassian.

### Raport logowania i postepu (opcjonalny, niezalezny od wyboru dostawcy)

Trzecie pole w sekcji „Logowanie” - „Adres raportowania” - to adres web triggera
`onboarding-report` (patrz `manifest.yml` w katalogu glownym), rowniez widoczny w panelu Forge
obok pozostalych dwoch adresow. Dziala z KAZDYM skonfigurowanym dostawcem (Microsoft i/lub
Atlassian) - nie trzeba go osobno wlaczac per dostawca. Zostawienie tego pola pustym oznacza po
prostu brak raportu (logowanie i synchronizacja dzialaja normalnie, tylko admin nie zobaczy kto
sie zalogowal).

## Zabezpieczenie endpointu synchronizacji tokenem logowania

Domyslnie `src/webTrigger.js` w katalogu glownym jest otwarty (patrz komentarz w tym pliku).
Zeby zaczal wymagac zalogowania:

- Dla Microsoft: ustaw `forge variables set --encrypt MS_OAUTH_CLIENT_ID <ten sam client id co w
  rozszerzeniu>` oraz `MS_OAUTH_TENANT_ID <tenant id>`. Endpoint zacznie kryptograficznie
  weryfikowac podpis JWT wzgledem kluczy publicznych Microsoftu (JWKS) oraz sprawdzac `aud`/`iss`.
- Dla Atlassian: ustaw `forge variables set --encrypt REQUIRE_ATLASSIAN_AUTH true`. Endpoint
  zacznie sprawdzac token wywolaniem `GET https://api.atlassian.com/me` (musi zwrocic 200).

## Co zostalo zweryfikowane, a co nie

**Zweryfikowane w tym srodowisku:**
- Skladnia wszystkich plikow (`node --check`, bundlowanie esbuild z rozwiazywaniem importow),
  wlacznie z `src/onboardingReport.js` i `src/identity.js`.
- Manifest Forge (`manifest.yml`) wzgledem oficjalnego schematu `@forge/manifest` (pole
  `permissions.external.fetch.backend` istnieje i przyjmuje liste domen; `jira:issuePanel` i
  `jira:adminPage` maja teraz ROZDZIELONE funkcje resolvera - `panelResolver` / `adminResolver` -
  zeby operacje admina, w tym nowy raport, nie byly technicznie osiagalne z mostka panelu
  widocznego dla kazdego pracownika).
- Realne zaladowanie rozszerzenia (z nowym `background.js` jako modul ES, importujacym
  `auth/microsoft.js` i `auth/atlassian.js`) w prawdziwym Chromium - service worker startuje bez
  bledow, `options.html` i `popup.html` renderuja sie bez wyjatkow JS w konsoli (sprawdzone przez
  CDP `Runtime.exceptionThrown` / `Runtime.consoleAPICalled`), takze po dodaniu raportowania.

**NIE zweryfikowane** (brak dostepu do prawdziwego konta Microsoft Entra / Atlassian w tym
srodowisku):
- Peine przejscie logowania "live" - ekran logowania dostawcy, wymiana kodu na token, walidacja
  JWT wzgledem prawdziwego JWKS Microsoftu, wywolanie `api.atlassian.com/me` z prawdziwym tokenem.
  Kod jest zgodny z udokumentowanymi protokolami (OAuth 2.0 Authorization Code + PKCE, OIDC dla
  Microsoft), ale dokladne zachowanie (np. czy Twoja konkretna konfiguracja aplikacji w Entra/
  Atlassian jest poprawna) trzeba sprawdzic recznie po zarejestrowaniu prawdziwych aplikacji.
- Odswiezanie tokenu (`refresh_token`) - w tej wersji po wygasnieciu tokenu (typowo ok. 1h)
  rozszerzenie po prostu wraca do stanu "wymagane logowanie" i prosi o ponowne, interaktywne
  zalogowanie. Ciche odswiezanie w tle to mozliwe rozszerzenie na przyszlosc, nie jest
  zaimplementowane.
- Raport (`getOnboardingReport` w `src/resolvers/admin.js`) uzywa `storage.query().where('key',
  startsWith('report:'))` - API istnieje i ma taki ksztalt w zainstalowanym pakiecie
  `@forge/storage`, ale zapytanie nie zostalo wykonane na zywym Forge Storage (brak wdrozenia).
  Scope `read:jira-user` (potrzebny, zeby panel na widoku zgloszenia mogl pobrac wyswietlana
  nazwe/e-mail uzytkownika do raportu) rowniez nie zostal zweryfikowany na zywo - jesli okaze sie
  niepoprawny, `forge deploy`/runtime zwroci czytelny blad (nie cichy fail bezpieczenstwa), a
  panel i tak dalej dziala - po prostu raport pokaze accountId zamiast imienia i nazwiska.

Przed wdrozeniem na produkcje: zarejestruj prawdziwe aplikacje u obu dostawcow, skonfiguruj jedna
osobe testowa i przejdz cala sciezke recznie (logowanie -> synchronizacja -> tour na stronie
Jiry) zanim wlaczysz to dla calej organizacji.
