# Pilot WiFi do TV

Uniwersalna aplikacja Flutter (Android + iOS) do sterowania telewizorem po
WiFi - bez reklam, bez telemetrii, bez chmury. Wszystko dzieje się lokalnie,
w Twojej sieci domowej, bezpośrednio między telefonem a telewizorem.

Obsługiwane telewizory:

| Marka | Protokół | Wymaganie na TV |
|---|---|---|
| Android TV / Google TV (np. Xiaomi Mi Box, Nvidia Shield, Chromecast z Google TV) | ADB (Android Debug Bridge) po sieci, port 5555 | Włącz **Ustawienia -> Opcje deweloperskie -> Debugowanie sieciowe** (na Mi Box czasem "Debugowanie USB/ADB") |
| Samsung (Tizen, 2018+) | WebSocket `samsung.remote.control`, port 8001/8002 | Nic - przy pierwszym połączeniu telewizor pokaże pytanie o zgodę |
| LG (webOS) | SSAP przez WebSocket, port 3000/3001 | Nic - przy pierwszym połączeniu telewizor pokaże pytanie o zgodę |

## Jak to działa

1. Aplikacja skanuje lokalną sieć (SSDP/UPnP + skan podsieci /24) albo
   pozwala dodać telewizor ręcznie po adresie IP.
2. Przy pierwszym połączeniu z każdą marką telewizor pyta o zgodę na
   sparowanie (fizycznie trzeba to zaakceptować oryginalnym pilotem TV) -
   dokładnie tak, jak w oficjalnych appkach producentów.
3. Klucz/token parowania jest zapisywany bezpiecznie na telefonie
   (`flutter_secure_storage` - Android Keystore / iOS Keychain), więc kolejne
   połączenia są automatyczne.
4. Przyciski pilota (strzałki, OK, głośność, kanały, media, cyfry, tekst)
   są tłumaczone na komendy specyficzne dla protokołu danej marki.

## Wymagania do zbudowania

Repozytorium zawiera kod Dart aplikacji (`lib/`) i `pubspec.yaml`, ale **nie
zawiera projektów natywnych `android/` i `ios/`** - to środowisko, w którym
powstał ten kod, nie miało zainstalowanego Flutter SDK, więc nic nie
zostało tu skompilowane ani uruchomione. Wygenerowanie projektów natywnych
ręcznie (zwłaszcza pliku `ios/Runner.xcodeproj/project.pbxproj`) bez
działającego Flutter SDK byłoby zbyt ryzykowne - łatwo go w ten sposób
uszkodzić. Zamiast tego zrób to oficjalnym narzędziem:

```bash
flutter --version          # Flutter 3.24+ zalecane
flutter create .           # dopisuje android/ i ios/ do istniejącego projektu
flutter pub get
flutter run                # albo: flutter build apk / flutter build ios
```

`flutter create .` w katalogu z istniejącym `pubspec.yaml` i `lib/` bezpiecznie
dokłada tylko brakujące foldery platform, nie ruszając kodu Dart.

## Ograniczenia i rzeczy do zweryfikowania na prawdziwym sprzęcie

Kod nie mógł zostać uruchomiony ani skompilowany w tym środowisku (brak
Flutter SDK), więc traktuj to jako solidny szkielet do przetestowania, a nie
gotowy, zweryfikowany produkt:

- **Android TV/ADB** (`lib/adapters/adb/`) - protokół ADB (ramki
  CNXN/AUTH/OPEN/WRTE/OKAY/CLSE, uwierzytelnianie RSA, format klucza
  publicznego `adbd`) nie jest formalnie udokumentowany przez Google - kod
  bazuje na strukturach z AOSP (`android_pubkey.cpp`, `protocol.txt`) i jest
  najbardziej złożoną częścią projektu. Najbardziej prawdopodobne miejsce
  na błędy przy pierwszym teście.
- **Samsung** i **LG** - oparte na powszechnie używanych, ale również
  nieoficjalnych (reverse-engineered) bibliotekach społecznościowych
  (`samsungtvws`, `lgtv2`/`bscpylgtv`, integracje Home Assistant) - w
  praktyce bardzo stabilne i szeroko sprawdzone, ale mogą się różnić między
  rocznikami telewizorów.
- Samsung: obsługiwane są tylko modele 2018+ (protokół tokenowy). Starsze
  Tizen (2016-2017) używały innego, PIN-owego parowania - nieobsługiwane.
- LG: włączenie telewizora z pełnego wyłączenia (Wake-on-LAN) nie jest
  zaimplementowane - `power` wysyła tylko `turnOff`.
- Wykrywanie sieci zakłada typową domową podsieć klasy /24.
- Brak testów jednostkowych/integracyjnych - do dodania po pierwszym
  uruchomieniu na prawdziwym telewizorze.

## Struktura kodu

```
lib/
  models/            # TvDevice, TvBrand, RemoteAction
  core/               # TvAdapter (wspólny interfejs), repozytorium, fabryka adapterów
  adapters/
    adb/              # Android TV / Google TV / Mi Box (ADB po sieci)
    samsung/          # Samsung Tizen (WebSocket)
    lgwebos/          # LG webOS (SSAP przez WebSocket)
  discovery/          # SSDP + skan podsieci
  services/           # RemoteManager (stan aplikacji, provider)
  screens/            # Lista urządzeń, dodawanie, parowanie, pilot, ustawienia
  widgets/            # D-pad, przyciski pilota, kafelek urządzenia
```

Każda marka telewizora to osobny plik implementujący `TvAdapter` - dodanie
kolejnej (np. Roku, Fire TV) sprowadza się do napisania jednego nowego
adaptera.
