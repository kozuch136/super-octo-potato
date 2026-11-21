import SwiftUI

struct SettingsView: View {
    @AppStorage(Keys.backend) private var backend = Backend.claudeCode.rawValue
    @AppStorage(Keys.model) private var model = AppSettings.defaultModel
    @AppStorage(Keys.cliPath) private var cliPath = ""
    @AppStorage(Keys.sourceLang) private var sourceLang = "pl-PL"
    @AppStorage(Keys.targetLang) private var targetLang = "en-US"
    @AppStorage(Keys.outputMode) private var outputMode = OutputMode.translation.rawValue
    @AppStorage(Keys.liveTranslation) private var liveTranslation = true
    @AppStorage(Keys.hotkeyKey) private var hotkeyKey = HotkeyKey.rightOption.rawValue
    @AppStorage(Keys.hotkeyMode) private var hotkeyMode = HotkeyMode.hold.rawValue
    @AppStorage(Keys.autoPaste) private var autoPaste = true

    @State private var apiKey = Keychain.load() ?? ""
    @State private var cliStatus = ""

    var body: some View {
        Form {
            Section("Języki") {
                Picker("Mówię po", selection: $sourceLang) {
                    ForEach(Languages.all) { Text("\($0.name) (\($0.id))").tag($0.id) }
                }
                Picker("Tłumacz na", selection: $targetLang) {
                    ForEach(Languages.all) { Text($0.name).tag($0.id) }
                }
                Picker("Wklejaj", selection: $outputMode) {
                    ForEach(OutputMode.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Toggle("Tłumacz na żywo podczas mówienia", isOn: $liveTranslation)
                Toggle("Automatycznie wklejaj (⌘V)", isOn: $autoPaste)
            }

            Section("Skrót") {
                Picker("Klawisz", selection: $hotkeyKey) {
                    ForEach(HotkeyKey.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Picker("Tryb", selection: $hotkeyMode) {
                    ForEach(HotkeyMode.allCases) { Text($0.label).tag($0.rawValue) }
                }
            }

            Section("Claude") {
                Picker("Połączenie", selection: $backend) {
                    ForEach(Backend.allCases) { Text($0.label).tag($0.rawValue) }
                }
                TextField("Model", text: $model)
                    .help("np. claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5")

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
                    Text("Używa Twojego logowania Claude Pro/Max z Claude Code (`claude` → /login). Bez klucza API.")
                        .font(.caption).foregroundStyle(.secondary)
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
        .frame(width: 520, height: 600)
    }
}
