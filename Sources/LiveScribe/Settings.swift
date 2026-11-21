import Foundation
import Security

enum Backend: String, CaseIterable, Identifiable {
    case claudeCode   // subskrypcja Claude (Pro/Max) przez Claude Code CLI
    case api          // klucz API Anthropic
    var id: String { rawValue }
    var label: String {
        switch self {
        case .claudeCode: return "Subskrypcja Claude (Claude Code CLI)"
        case .api: return "Klucz API Anthropic"
        }
    }
}

enum OutputMode: String, CaseIterable, Identifiable {
    case translation, original, both
    var id: String { rawValue }
    var label: String {
        switch self {
        case .translation: return "Tylko tłumaczenie"
        case .original: return "Tylko oryginał (bez tłumaczenia)"
        case .both: return "Oryginał + tłumaczenie"
        }
    }
}

enum HotkeyKey: String, CaseIterable, Identifiable {
    case rightOption, rightCommand, rightControl, fn
    var id: String { rawValue }
    var label: String {
        switch self {
        case .rightOption: return "Prawy ⌥ Option"
        case .rightCommand: return "Prawy ⌘ Command"
        case .rightControl: return "Prawy ⌃ Control"
        case .fn: return "fn / 🌐"
        }
    }
    var keyCode: UInt16 {
        switch self {
        case .rightOption: return 61
        case .rightCommand: return 54
        case .rightControl: return 62
        case .fn: return 63
        }
    }
}

enum HotkeyMode: String, CaseIterable, Identifiable {
    case hold, toggle
    var id: String { rawValue }
    var label: String { self == .hold ? "Przytrzymaj, aby mówić" : "Naciśnij, aby włączyć/wyłączyć" }
}

struct Language: Identifiable, Hashable {
    let id: String      // identyfikator locale dla rozpoznawania mowy
    let name: String    // nazwa używana w prompcie tłumaczenia
}

enum Languages {
    static let all: [Language] = [
        .init(id: "pl-PL", name: "Polish"),
        .init(id: "en-US", name: "English"),
        .init(id: "en-GB", name: "English (UK)"),
        .init(id: "de-DE", name: "German"),
        .init(id: "fr-FR", name: "French"),
        .init(id: "es-ES", name: "Spanish"),
        .init(id: "it-IT", name: "Italian"),
        .init(id: "pt-BR", name: "Portuguese"),
        .init(id: "nl-NL", name: "Dutch"),
        .init(id: "cs-CZ", name: "Czech"),
        .init(id: "uk-UA", name: "Ukrainian"),
        .init(id: "ru-RU", name: "Russian"),
        .init(id: "ja-JP", name: "Japanese"),
        .init(id: "ko-KR", name: "Korean"),
        .init(id: "zh-CN", name: "Chinese (Simplified)"),
    ]
    static func name(for id: String) -> String { all.first { $0.id == id }?.name ?? id }
}

/// Klucze UserDefaults (używane też przez @AppStorage w SettingsView).
enum Keys {
    static let backend = "backend"
    static let model = "model"
    static let cliPath = "cliPath"
    static let sourceLang = "sourceLang"
    static let targetLang = "targetLang"
    static let outputMode = "outputMode"
    static let liveTranslation = "liveTranslation"
    static let hotkeyKey = "hotkeyKey"
    static let hotkeyMode = "hotkeyMode"
    static let autoPaste = "autoPaste"
}

struct AppSettings {
    static let defaultModel = "claude-opus-5-5"

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            Keys.backend: Backend.claudeCode.rawValue,
            Keys.model: defaultModel,
            Keys.cliPath: "",
            Keys.sourceLang: "pl-PL",
            Keys.targetLang: "en-US",
            Keys.outputMode: OutputMode.translation.rawValue,
            Keys.liveTranslation: true,
            Keys.hotkeyKey: HotkeyKey.rightOption.rawValue,
            Keys.hotkeyMode: HotkeyMode.hold.rawValue,
            Keys.autoPaste: true,
        ])
    }

    private static var d: UserDefaults { .standard }
    static var backend: Backend { Backend(rawValue: d.string(forKey: Keys.backend) ?? "") ?? .claudeCode }
    static var model: String {
        let m = (d.string(forKey: Keys.model) ?? "").trimmingCharacters(in: .whitespaces)
        return m.isEmpty ? defaultModel : m
    }
    static var cliPath: String { d.string(forKey: Keys.cliPath) ?? "" }
    static var sourceLang: String { d.string(forKey: Keys.sourceLang) ?? "pl-PL" }
    static var targetLang: String { d.string(forKey: Keys.targetLang) ?? "en-US" }
    static var outputMode: OutputMode { OutputMode(rawValue: d.string(forKey: Keys.outputMode) ?? "") ?? .translation }
    static var liveTranslation: Bool { d.bool(forKey: Keys.liveTranslation) }
    static var hotkeyKey: HotkeyKey { HotkeyKey(rawValue: d.string(forKey: Keys.hotkeyKey) ?? "") ?? .rightOption }
    static var hotkeyMode: HotkeyMode { HotkeyMode(rawValue: d.string(forKey: Keys.hotkeyMode) ?? "") ?? .hold }
    static var autoPaste: Bool { d.bool(forKey: Keys.autoPaste) }
}

/// Minimalny wrapper na Keychain do przechowywania klucza API.
enum Keychain {
    private static let service = "com.livescribe.app"
    private static let account = "anthropic-api-key"

    static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ value: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard !value.isEmpty else { return }
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(add as CFDictionary, nil)
    }
}
