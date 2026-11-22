# LiveScribe

Aplikacja na macOS (pasek menu) w stylu [Handy](https://github.com/cjpais/Handy): przytrzymujesz klawisz, mówisz, puszczasz – tekst wkleja się w aktywne okno. Dodatkowo **tłumaczy na żywo** przez Claude.

## Jak działa

1. Przytrzymaj **prawy ⌥ Option** (zmienisz w Ustawieniach) i mów.
2. **Mowa → tekst** lokalnie: **Whisper Large-v3 Turbo** przez [WhisperKit](https://github.com/argmaxinc/argmax-oss-swift), czyli ten sam rodzaj modelu co w Handy (dobry dla polskiego). Alternatywnie Apple Speech.
3. **Podgląd na żywo**: co ok. 1 s Whisper odświeża tekst, a [Apple Translation](https://developer.apple.com/documentation/translation/translationsession) od razu, lokalnie, tłumaczy go na angielski w pływającym okienku.
4. Puszczasz klawisz → **tłumaczenie końcowe** wybranym silnikiem → wklejenie ⌘V.

### Silniki tłumaczenia końcowego

| Silnik | Jakość | Offline | Uwagi |
|---|---|---|---|
| **Claude** (domyślny) | najlepsza, poprawia błędy rozpoznawania | nie | subskrypcja (Claude Code) lub klucz API |
| **TranslateGemma** przez [Ollama](https://ollama.com) | bardzo dobra | tak | `ollama pull translategemma:4b` (lub `:12b` przy 16 GB+ RAM) |
| **Whisper translate** | dobra, czasem dosłowna | tak | mowa → EN w jednym kroku; wymaga pełnego `large-v3` (Turbo nie tłumaczy) |
| **Apple Translation** | średnia/dobra | tak | najszybszy |

Podgląd na żywo może używać Apple Translation (domyślnie), tego samego silnika co końcowy, albo być wyłączony.

**W pełni offline:** Whisper + (TranslateGemma lub Whisper translate lub Apple).

## Budowanie

Wymagania: macOS 15+ (Apple Translation w aplikacji: macOS 26.4+), Xcode 16+, Apple Silicon zalecany.

```bash
./scripts/build_app.sh
cp -R build/LiveScribe.app /Applications/
open /Applications/LiveScribe.app
```

Albo w Xcode: `File → Open…` → `Package.swift` (do uruchamiania z uprawnieniami lepszy jest jednak zbudowany `.app`).

## Uprawnienia (przy pierwszym uruchomieniu)

- **Mikrofon** i **Rozpoznawanie mowy** – okienka systemowe.
- **Języki Apple Translation** – w Ustawieniach LiveScribe kliknij „Pobierz języki Apple Translation”.
- **Model Whisper** pobiera się przy pierwszym uruchomieniu (status w menu).
- **Dostępność** (Ustawienia systemowe → Prywatność i ochrona → Dostępność) – potrzebna do globalnego skrótu i wklejania ⌘V. Bez niej tekst trafia tylko do schowka.

> Po każdym przebudowaniu (podpis ad-hoc) macOS może wymagać ponownego włączenia LiveScribe w „Dostępności” – usuń stary wpis i dodaj nowy.

## Struktura

```
Sources/LiveScribe/
  LiveScribeApp.swift   – pasek menu + okno ustawień
  AppState.swift        – logika: skrót → nagrywanie → tłumaczenie → wklejenie
  WhisperEngine.swift   – Whisper (WhisperKit): nagrywanie 16 kHz, podgląd, translate
  SpeechRecognizer.swift– Apple Speech (strumieniowo)
  Translator.swift      – Claude (API/CLI), Ollama, Apple Translation
  HotkeyMonitor.swift   – globalny skrót (klawisz modyfikujący)
  Paster.swift          – schowek + ⌘V
  Overlay.swift         – pływające okienko z podglądem
  Settings.swift        – ustawienia, języki, Keychain
```

## Dokumentacja

- Claude Messages API / streaming: https://platform.claude.com/docs/en/build-with-claude/streaming
- Claude Code CLI: https://code.claude.com/docs/en/cli-reference
- Apple Speech: https://developer.apple.com/documentation/speech
- Apple Translation: https://developer.apple.com/documentation/translation
- WhisperKit: https://github.com/argmaxinc/argmax-oss-swift
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
- TranslateGemma: https://blog.google/innovation-and-ai/technology/developers-tools/translategemma/
- MenuBarExtra: https://developer.apple.com/documentation/swiftui/menubarextra
