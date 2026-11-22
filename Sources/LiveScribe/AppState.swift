import AppKit
import SwiftUI

/// Koordynator: skrót → nagrywanie → podgląd tłumaczenia na żywo → tłumaczenie końcowe → wklejenie.
@MainActor
final class AppState: ObservableObject {
    @Published var isRecording = false
    @Published var isTranslating = false
    @Published var transcript = ""
    @Published var translation = ""
    @Published var status = "Gotowy"
    @Published var lastError: String?

    private let appleSpeech = SpeechRecognizer()
    private let whisper = WhisperEngine()
    private var engine: SpeechEngine?
    private let hotkey = HotkeyMonitor()
    private lazy var overlay = OverlayController(state: self)

    private var debounceTask: Task<Void, Never>?
    private var previewTask: Task<Void, Never>?
    private var finalTask: Task<String?, Never>?
    private var finalSource = ""          // tekst, dla którego trwa/zakończyło się tłumaczenie końcowe
    private var finalDone = false
    private var pressedAt = Date()

    init() {
        AppSettings.registerDefaults()
        hotkey.onPress = { [weak self] in self?.hotkeyPressed() }
        hotkey.onRelease = { [weak self] in self?.hotkeyReleased() }
        hotkey.start()
        appleSpeech.onPartial = { [weak self] text in self?.handlePartial(text) }
        whisper.onPartial = { [weak self] text in self?.handlePartial(text) }

        Task {
            let perms = await SpeechRecognizer.requestPermissions()
            if !perms.mic { self.status = "Brak dostępu do mikrofonu" }
            else if AppSettings.sttEngine == .apple && !perms.speech { self.status = "Brak zgody na rozpoznawanie mowy" }
            if !Paster.isTrusted { Paster.promptForAccessibility() }
            await self.prepareWhisper()
        }
    }

    /// Pobiera/ładuje model Whisper z wyprzedzeniem, żeby pierwsze dyktowanie było szybkie.
    func prepareWhisper() async {
        guard AppSettings.sttEngine == .whisper else { return }
        let model = AppSettings.whisperModel
        if await WhisperService.shared.isLoaded(model) { return }
        status = "Pobieram/ładuję model Whisper (\(model))…"
        do {
            _ = try await WhisperService.shared.pipe(model)
            status = "Gotowy"
        } catch {
            fail(error)
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
        if Date().timeIntervalSince(pressedAt) < 0.25 { cancelRecording(); return }
        stopRecording()
    }

    // MARK: Nagrywanie

    func toggleFromMenu() { isRecording ? stopRecording() : startRecording() }

    func startRecording() {
        guard !isRecording else { return }
        resetSession()
        let e: SpeechEngine = AppSettings.sttEngine == .whisper ? whisper : appleSpeech
        engine = e
        do {
            try e.start(localeID: AppSettings.sourceLang)
            isRecording = true
            status = "Słucham…"
            overlay.show()
        } catch {
            fail(error)
        }
    }

    func cancelRecording() {
        engine?.cancel()
        isRecording = false
        resetSession()
        overlay.hide()
        status = "Gotowy"
    }

    func stopRecording() {
        guard isRecording, let engine else { return }
        isRecording = false
        debounceTask?.cancel()
        status = "Kończę rozpoznawanie…"

        Task {
            let finalText: String
            do {
                finalText = try await engine.stop().trimmingCharacters(in: .whitespacesAndNewlines)
            } catch {
                fail(error)
                overlay.hide(after: 2.5)
                return
            }
            transcript = finalText
            guard !finalText.isEmpty else {
                status = "Nic nie usłyszano"
                overlay.hide(after: 0.8)
                return
            }

            let mode = AppSettings.outputMode
            guard mode != .original else { deliver(finalText); return }

            status = "Tłumaczę…"
            previewTask?.cancel()
            guard let translated = await finalTranslation(for: finalText) else {
                deliver(finalText) // błąd tłumaczenia → wklej przynajmniej oryginał
                return
            }
            translation = translated
            deliver(mode == .both ? "\(finalText)\n\(translated)" : translated)
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

    // MARK: Podgląd na żywo

    private func handlePartial(_ text: String) {
        guard isRecording else { return }
        transcript = text
        guard AppSettings.outputMode != .original else { return }

        switch AppSettings.previewEngine {
        case .off:
            return
        case .apple:
            // Apple Translation jest lokalny i szybki – wystarczy krótki debounce.
            debounce(0.25) { self.runPreview(text, with: AppleTranslator()) }
        case .final:
            // Silnik końcowy w trakcie mówienia; wynik może zostać od razu wklejony.
            guard AppSettings.finalEngine != .whisper else { return } // Whisper translate działa na nagraniu, nie na tekście
            debounce(0.65) { if text != self.finalSource { self.launchFinal(of: text) } }
        }
    }

    private func debounce(_ seconds: Double, _ action: @escaping @MainActor () -> Void) {
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled, self.isRecording else { return }
            action()
        }
    }

    private func runPreview(_ text: String, with translator: Translator) {
        previewTask?.cancel()
        let from = AppSettings.sourceLang, to = AppSettings.targetLang
        previewTask = Task { [weak self] in
            do {
                _ = try await translator.translate(text, from: from, to: to) { partial in
                    guard let self, self.isRecording else { return }
                    self.translation = partial
                }
            } catch is CancellationError {
            } catch {
                guard !Task.isCancelled else { return }
                self?.lastError = error.localizedDescription
            }
        }
    }

    // MARK: Tłumaczenie końcowe

    @discardableResult
    private func launchFinal(of text: String) -> Task<String?, Never> {
        finalTask?.cancel()
        finalSource = text
        finalDone = false
        isTranslating = true
        let from = AppSettings.sourceLang, to = AppSettings.targetLang
        let translator = TranslatorFactory.make(AppSettings.finalEngine)

        let task = Task<String?, Never> { [weak self] in
            do {
                let result = try await translator.translate(text, from: from, to: to) { partial in
                    guard let self, self.finalSource == text else { return }
                    self.translation = partial
                }
                guard let self, !Task.isCancelled, self.finalSource == text else { return nil }
                self.finalDone = true
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
        finalTask = task
        return task
    }

    private func finalTranslation(for text: String) async -> String? {
        let engineChoice = AppSettings.finalEngine
        let targetIsEnglish = Languages.code(for: AppSettings.targetLang) == "en"

        // Whisper translate: mowa → angielski bezpośrednio z nagrania.
        if engineChoice == .whisper, targetIsEnglish, engine === whisper {
            isTranslating = true
            defer { isTranslating = false }
            do {
                let english = try await whisper.translateLastToEnglish()
                if !english.isEmpty { return english }
            } catch {
                fail(error)
            }
            status = "Whisper translate nie zadziałał – używam Claude"
        }

        // Ponowne użycie tłumaczenia rozpoczętego w trakcie mówienia.
        if text == finalSource, let running = finalTask {
            if finalDone, let r = await running.value { return r }
            if let r = await running.value { return r }
        }
        return await launchFinal(of: text).value
    }

    // MARK: Pomocnicze

    private func resetSession() {
        debounceTask?.cancel()
        previewTask?.cancel()
        finalTask?.cancel()
        finalTask = nil
        transcript = ""
        translation = ""
        finalSource = ""
        finalDone = false
        isTranslating = false
        lastError = nil
    }

    private func fail(_ error: Error) {
        let msg = error.localizedDescription
        lastError = msg
        status = "Błąd: \(msg)"
    }
}
