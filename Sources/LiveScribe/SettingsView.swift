import SwiftUI
import Translation

struct SettingsView: View {
    @AppStorage(Keys.backend) private var backend = Backend.claudeCode.rawValue
    @AppStorage(Keys.model) private var model = AppSettings.defaultModel
    @AppStorage(Keys.cliPath) private var cliPath = ""
    @AppStorage(Keys.sourceLang) private var sourceLang = "pl-PL"
    @AppStorage(Keys.targetLang) private var targetLang = "en-US"
    @AppStorage(Keys.outputMode) private var outputMode = OutputMode.translation.rawValue
    @AppStorage(Keys.hotkeyKey) private var hotkeyKey = HotkeyKey.rightOption.rawValue
    @AppStorage(Keys.hotkeyMode) private var hotkeyMode = HotkeyMode.hold.rawValue
    @AppStorage(Keys.autoPaste) private var autoPaste = true
    @AppStorage(Keys.sttEngine) private var sttEngine = STTEngine.whisper.rawValue
    @AppStorage(Keys.whisperModel) private var whisperModel = AppSettings.defaultWhisperModel
    @AppStorage(Keys.whisperTranslateModel) private var whisperTranslateModel = AppSettings.defaultWhisperTranslateModel
    @AppStorage(Keys.previewEngine) private var previewEngine = PreviewEngine.apple.rawValue
    @AppStorage(Keys.finalEngine) private var finalEngine = FinalEngine.claude.rawValue
    @AppStorage(Keys.ollamaModel) private var ollamaModel = AppSettings.defaultOllamaModel
    @AppStorage(Keys.ollamaURL) private var ollamaURL = AppSettings.defaultOllamaURL

    @State private var apiKey = Keychain.load() ?? ""
    @State private var cliStatus = ""
    @State private var appleStatus = ""
    @State private var translationConfig: TranslationSession.Configuration?

    private var usesApple: Bool { previewEngine == PreviewEngine.apple.rawValue || finalEngine == FinalEngine.apple.rawValue }
    private var usesClaude: Bool { finalEngine == FinalEngine.claude.rawValue || finalEngine == FinalEngine.whisper.rawValue }

    var body: some View {
        Form {
            Section("Języki i wklejanie") {
                Picker("Mówię po", selection: $sourceLang) {
                    ForEach(Languages.all) { Text("\($0.name) (\($0.id))").tag($0.id) }
                }
                Picker("Tłumacz na", selection: $targetLang) {
                    ForEach(Languages.all) { Text($0.name).tag($0.id) }
                }
                Picker("Wklejaj", selection: $outputMode) {
                    ForEach(OutputMode.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Toggle("Automatycznie wklejaj (⌘V)", isOn: $autoPaste)
            }

            Section("Mowa → tekst") {
                Picker("Silnik", selection: $sttEngine) {
                    ForEach(STTEngine.allCases) { Text($0.label).tag($0.rawValue) }
                }
                if sttEngine == STTEngine.whisper.rawValue {
                    TextField("Model Whisper", text: $whisperModel)
                    Text("Domyślnie Large-v3 Turbo. Pobierany przy pierwszym uruchomieniu (~600 MB–1,5 GB). Inne: large-v3-v20240930_626MB, small, base.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }

            Section("Tłumaczenie") {
                Picker("Podgląd na żywo", selection: $previewEngine) {
                    ForEach(PreviewEngine.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Picker("Tekst do wklejenia", selection: $finalEngine) {
                    ForEach(FinalEngine.allCases) { Text($0.label).tag($0.rawValue) }
                }
                if finalEngine == FinalEngine.whisper.rawValue {
                    TextField("Model Whisper do tłumaczenia", text: $whisperTranslateModel)
                    Text("Tylko na angielski i tylko z silnikiem Whisper. Turbo nie umie tłumaczyć – użyj pełnego large-v3. W innym przypadku użyty zostanie Claude.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if finalEngine == FinalEngine.gemma.rawValue {
                    TextField("Model Ollama", text: $ollamaModel)
                    TextField("Adres Ollama", text: $ollamaURL)
                    Text("Zainstaluj Ollama i pobierz model, np. `ollama pull \(ollamaModel)`.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if usesApple {
                    HStack {
                        Button("Pobierz języki Apple Translation") { downloadAppleLanguages() }
                        Text(appleStatus).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }

            if usesClaude {
                Section("Claude") {
                    Picker("Połączenie", selection: $backend) {
                        ForEach(Backend.allCases) { Text($0.label).tag($0.rawValue) }
                    }
                    TextField("Model", text: $model)
                        .help("np. claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5 (najszybszy)")

                    if backend == Backend.api.rawValue {
                        SecureField("Klucz API", text: $apiKey)
                            .onSubmit { Keychain.save(apiKey) }
                            .onChange(of: apiKey) { _, new in Keychain.save(new) }
                        Text("Klucz trzymany w pęku kluczy macOS. platform.claude.com → API Keys.")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        TextField("Ścieżka do `claude` (puste = auto)", text: $cliPath)
                        HStack {
                            Button("Sprawdź Claude Code") {
                                cliStatus = ClaudeCodeTranslator.findCLI().map { "Znaleziono: \($0)" }
                                    ?? "Nie znaleziono – zainstaluj Claude Code i zaloguj się subskrypcją."
                            }
                            Text(cliStatus).font(.caption).foregroundStyle(.secondary)
                        }
                        Text("Używa logowania Claude Pro/Max z Claude Code (`claude` → /login). Bez klucza API.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }

            Section("Skrót") {
                Picker("Klawisz", selection: $hotkeyKey) {
                    ForEach(HotkeyKey.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Picker("Tryb", selection: $hotkeyMode) {
                    ForEach(HotkeyMode.allCases) { Text($0.label).tag($0.rawValue) }
                }
            }

            Section("Uprawnienia") {
                HStack {
                    Text(Paster.isTrusted ? "Dostępność: przyznana ✅" : "Dostępność: brak ⚠️")
                    Spacer()
                    Button("Otwórz ustawienia") { Paster.promptForAccessibility() }
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 560, height: 720)
        // Pobieranie języków wymaga sesji z SwiftUI (systemowe okno zgody).
        // Docs: https://developer.apple.com/documentation/translation/translating-text-within-your-app
        .translationTask(translationConfig) { session in
            do {
                try await session.prepareTranslation()
                appleStatus = "Języki gotowe ✅"
            } catch {
                appleStatus = "Błąd: \(error.localizedDescription)"
            }
        }
    }

    private func downloadAppleLanguages() {
        let src = Locale.Language(identifier: Languages.code(for: sourceLang))
        let dst = Locale.Language(identifier: Languages.code(for: targetLang))
        if translationConfig?.source == src && translationConfig?.target == dst {
            translationConfig?.invalidate()
        } else {
            translationConfig = .init(source: src, target: dst)
        }
        appleStatus = "Pobieranie…"
    }
}
