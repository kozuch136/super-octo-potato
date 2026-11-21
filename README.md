# LiveScribe

Aplikacja na macOS (pasek menu) w stylu [Handy](https://github.com/cjpais/Handy): przytrzymujesz klawisz, mówisz, puszczasz – tekst wkleja się w aktywne okno. Dodatkowo **tłumaczy na żywo** przez Claude.

## Jak działa

1. Przytrzymaj **prawy ⌥ Option** (zmienisz w Ustawieniach) i mów.
2. Mowa → tekst: Apple Speech, na urządzeniu ([SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer)).
3. W trakcie mówienia, przy każdej krótkiej pauzie, Claude tłumaczy tekst strumieniowo – widzisz to w pływającym okienku.
4. Puszczasz klawisz → tłumaczenie (albo oryginał / oba) wkleja się przez ⌘V.

## Claude: subskrypcja lub klucz API

| Tryb | Co potrzebujesz |
|---|---|
| **Subskrypcja Claude (domyślnie)** | [Claude Code](https://code.claude.com/docs/en/setup) zainstalowany i zalogowany kontem Pro/Max (`claude` → `/login`). Aplikacja wywołuje `claude -p` w trybie [headless](https://code.claude.com/docs/en/headless) – bez klucza API. |
| **Klucz API** | Klucz z [platform.claude.com](https://platform.claude.com/) – zapisywany w pęku kluczy. Najszybszy tryb (bez uruchamiania procesu CLI). |

Domyślny model: `claude-opus-5-5`. Dla mniejszych opóźnień przy tłumaczeniu na żywo możesz w Ustawieniach wpisać `claude-haiku-5-5`.

## Budowanie

Wymagania: macOS 14+, Xcode 15+ (lub Command Line Tools ze Swift 5.9+).

```bash
./scripts/build_app.sh
cp -R build/LiveScribe.app /Applications/
open /Applications/LiveScribe.app
```

Albo w Xcode: `File → Open…` → `Package.swift` (do uruchamiania z uprawnieniami lepszy jest jednak zbudowany `.app`).

## Uprawnienia (przy pierwszym uruchomieniu)

- **Mikrofon** i **Rozpoznawanie mowy** – okienka systemowe.
- **Dostępność** (Ustawienia systemowe → Prywatność i ochrona → Dostępność) – potrzebna do globalnego skrótu i wklejania ⌘V. Bez niej tekst trafia tylko do schowka.

> Po każdym przebudowaniu (podpis ad-hoc) macOS może wymagać ponownego włączenia LiveScribe w „Dostępności” – usuń stary wpis i dodaj nowy.

## Struktura

```
Sources/LiveScribe/
  LiveScribeApp.swift   – pasek menu + okno ustawień
  AppState.swift        – logika: skrót → nagrywanie → tłumaczenie → wklejenie
  SpeechRecognizer.swift– Apple Speech (strumieniowo)
  Translator.swift      – Claude API (SSE) i Claude Code CLI (stream-json)
  HotkeyMonitor.swift   – globalny skrót (klawisz modyfikujący)
  Paster.swift          – schowek + ⌘V
  Overlay.swift         – pływające okienko z podglądem
  Settings.swift        – ustawienia, języki, Keychain
```

## Dokumentacja

- Claude Messages API / streaming: https://platform.claude.com/docs/en/build-with-claude/streaming
- Claude Code CLI: https://code.claude.com/docs/en/cli-reference
- Apple Speech: https://developer.apple.com/documentation/speech
- MenuBarExtra: https://developer.apple.com/documentation/swiftui/menubarextra
