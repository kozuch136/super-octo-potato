import AppKit
import SwiftUI

/// Koordynator: skrót → nagrywanie → tłumaczenie na żywo → wklejenie.
@MainActor
final class AppState: ObservableObject {
    @Published var isRecording = false
    @Published var isTranslating = false
    @Published var transcript = ""
    @Published var translation = ""
    @Published var status = "Gotowy"
    @Published var lastError: String?

    private let speech = SpeechRecognizer()
    private let hotkey = HotkeyMonitor()
    private lazy var overlay = OverlayController(state: self)

    private var debounceTask: Task<Void, Never>?
    private var translateTask: Task<String?, Never>?
    private var translatedSource = ""      // tekst źródłowy, dla którego trwa/zakończyło się tłumaczenie
    private var translationDone = false
    private var pressedAt = Date()

    init() {
        AppSettings.registerDefaults()
        hotkey.onPress = { [weak self] in self?.hotkeyPressed() }
        hotkey.onRelease = { [weak self] in self?.hotkeyReleased() }
        hotkey.start()
        speech.onPartial = { [weak self] text in self?.handlePartial(text) }

        Task {
            let perms = await SpeechRecognizer.requestPermissions()
            if !perms.mic { self.status = "Brak dostępu do mikrofonu" }
            else if !perms.speech { self.status = "Brak zgody na rozpoznawanie mowy" }
            if !Paster.isTrusted { Paster.promptForAccessibility() }
        }
    }

    // MARK: Skrót

    private func hotkeyPressed() {
        switch AppSettings.hotkeyMode {
        case .hold:
            pressedAt = Date()
            startRecording()
        case .toggle:
            isRecording ? stopRecording() : startRecording()
        }
    }

    private func hotkeyReleased() {
        guard AppSettings.hotkeyMode == .hold, isRecording else { return }
        // Bardzo krótkie naciśnięcie = przypadkowe, anuluj.
        if Date().timeIntervalSince(pressedAt) < 0.25 { cancelRecording(); return }
        stopRecording()
    }

    // MARK: Nagrywanie

    func toggleFromMenu() { isRecording ? stopRecording() : startRecording() }

    func startRecording() {
        guard !isRecording else { return }
        resetSession()
        do {
            try speech.start(localeID: AppSettings.sourceLang)
            isRecording = true
            status = "Słucham…"
            overlay.show()
        } catch {
            fail(error)
        }
    }

    func cancelRecording() {
        speech.cancel()
        isRecording = false
        resetSession()
        overlay.hide()
        status = "Gotowy"
    }

    func stopRecording() {
        guard isRecording else { return }
        isRecording = false
        debounceTask?.cancel()
        status = "Kończę…"

        Task {
            let finalText = await speech.stop().trimmingCharacters(in: .whitespacesAndNewlines)
            transcript = finalText
            guard !finalText.isEmpty else {
                status = "Nic nie usłyszano"
                overlay.hide()
                return
            }

            let mode = AppSettings.outputMode
            var output = finalText
            if mode != .original {
                status = "Tłumaczę…"
                guard let translated = await finalTranslation(for: finalText) else {
                    // błąd tłumaczenia → wklej przynajmniej oryginał
                    deliver(finalText)
                    return
                }
                output = mode == .both ? "\(finalText)\n\(translated)" : translated
            }
            deliver(output)
        }
    }

    private func deliver(_ text: String) {
        if AppSettings.autoPaste {
            Paster.paste(text)
            status = Paster.isTrusted ? "Wklejono" : "Skopiowano do schowka (brak uprawnienia Dostępność)"
        } else {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(text, forType: .string)
            status = "Skopiowano do schowka"
        }
        overlay.hide(after: 1.2)
    }

    // MARK: Tłumaczenie na żywo

    private func handlePartial(_ text: String) {
        transcript = text
        guard isRecording, AppSettings.liveTranslation, AppSettings.outputMode != .original else { return }
        debounceTask?.cancel()
        debounceTask = Task {
            // Tłumacz, gdy mówca robi krótką pauzę (stabilny wynik częściowy).
            try? await Task.sleep(nanoseconds: 650_000_000)
            guard !Task.isCancelled, self.isRecording, text != self.translatedSource else { return }
            self.launchTranslation(of: text)
        }
    }

    @discardableResult
    private func launchTranslation(of text: String) -> Task<String?, Never> {
        translateTask?.cancel()
        translatedSource = text
        translationDone = false
        isTranslating = true
        let from = Languages.name(for: AppSettings.sourceLang)
        let to = Languages.name(for: AppSettings.targetLang)
        let translator = TranslatorFactory.make()

        let task = Task<String?, Never> { [weak self] in
            do {
                let result = try await translator.translate(text, from: from, to: to) { partial in
                    guard let self, self.translatedSource == text else { return }
                    self.translation = partial
                }
                guard let self, !Task.isCancelled, self.translatedSource == text else { return nil }
                self.translation = result
                self.translationDone = true
                self.isTranslating = false
                return result
            } catch is CancellationError {
                return nil
            } catch {
                if Task.isCancelled { return nil }
                self?.isTranslating = false
                self?.fail(error)
                return nil
            }
        }
        translateTask = task
        return task
    }

    /// Używa gotowego tłumaczenia, jeśli dotyczy tego samego tekstu; inaczej tłumaczy od nowa.
    private func finalTranslation(for text: String) async -> String? {
        if text == translatedSource, let running = translateTask {
            if translationDone { return translation }
            if let r = await running.value { return r }
        }
        return await launchTranslation(of: text).value
    }

    // MARK: Pomocnicze

    private func resetSession() {
        debounceTask?.cancel()
        translateTask?.cancel()
        translateTask = nil
        transcript = ""
        translation = ""
        translatedSource = ""
        translationDone = false
        isTranslating = false
        lastError = nil
    }

    private func fail(_ error: Error) {
        let msg = error.localizedDescription
        lastError = msg
        status = "Błąd: \(msg)"
    }
}
