import AVFoundation
import Speech

enum SpeechError: LocalizedError {
    case unavailable(String)
    var errorDescription: String? {
        switch self {
        case .unavailable(let loc): return "Rozpoznawanie mowy niedostępne dla \(loc)"
        }
    }
}

/// Strumieniowe rozpoznawanie mowy (Apple Speech, na urządzeniu jeśli dostępne).
/// Docs: https://developer.apple.com/documentation/speech/sfspeechrecognizer
@MainActor
final class SpeechRecognizer {
    var onPartial: ((String) -> Void)?

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var transcript = ""
    private var finishContinuation: CheckedContinuation<String, Never>?

    static func requestPermissions() async -> (speech: Bool, mic: Bool) {
        let speech = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
        }
        let mic = await AVCaptureDevice.requestAccess(for: .audio)
        return (speech, mic)
    }

    func start(localeID: String) throws {
        cancel()
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeID)),
              recognizer.isAvailable else {
            throw SpeechError.unavailable(localeID)
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.addsPunctuation = true
        if recognizer.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }
        request = req
        transcript = ""

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }
        engine.prepare()
        try engine.start()

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let done = error != nil || (result?.isFinal ?? false)
            Task { @MainActor in
                guard let self else { return }
                if let text, !text.isEmpty {
                    self.transcript = text
                    self.onPartial?(text)
                }
                if done { self.resolveFinish() }
            }
        }
    }

    /// Zatrzymuje nagrywanie i czeka (maks. ~1.5 s) na finalny wynik.
    func stop() async -> String {
        stopAudio()
        request?.endAudio()
        if task == nil { return transcript }
        return await withCheckedContinuation { c in
            finishContinuation = c
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                self?.resolveFinish()
            }
        }
    }

    func cancel() {
        stopAudio()
        task?.cancel()
        task = nil
        request = nil
        resolveFinish()
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
    }

    private func resolveFinish() {
        if let c = finishContinuation {
            finishContinuation = nil
            task = nil
            request = nil
            c.resume(returning: transcript)
        }
    }
}
