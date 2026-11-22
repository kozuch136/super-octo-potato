import AVFoundation
import WhisperKit

/// Wspólny interfejs silników mowy → tekst.
@MainActor
protocol SpeechEngine: AnyObject {
    var onPartial: ((String) -> Void)? { get set }
    func start(localeID: String) throws
    func stop() async throws -> String
    func cancel()
}

// MARK: - Modele Whisper (WhisperKit, Core ML, na urządzeniu)
// Docs/źródła: https://github.com/argmaxinc/argmax-oss-swift

actor WhisperService {
    static let shared = WhisperService()

    private var pipes: [String: WhisperKit] = [:]
    private var loading: [String: Task<WhisperKit, Error>] = [:]

    /// Ładuje (i przy pierwszym użyciu pobiera) model. Kolejne wywołania zwracają ten sam obiekt.
    func pipe(_ model: String) async throws -> WhisperKit {
        if let p = pipes[model] { return p }
        if let t = loading[model] { return try await t.value }
        let t = Task { try await WhisperKit(WhisperKitConfig(model: model, verbose: false)) }
        loading[model] = t
        do {
            let p = try await t.value
            pipes[model] = p
            loading[model] = nil
            return p
        } catch {
            loading[model] = nil
            throw error
        }
    }

    func isLoaded(_ model: String) -> Bool { pipes[model] != nil }

    /// `task: .translate` = mowa w dowolnym języku → tekst angielski (tylko modele nie-Turbo).
    func run(_ audio: [Float], model: String, language: String, task: DecodingTask) async throws -> String {
        let p = try await pipe(model)
        let options = DecodingOptions(
            task: task,
            language: language,
            usePrefillPrompt: true,
            detectLanguage: false,
            skipSpecialTokens: true,
            withoutTimestamps: true,
            chunkingStrategy: .vad
        )
        let results = try await p.transcribe(audioArray: audio, decodeOptions: options)
        return results.map(\.text).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Nagrywanie 16 kHz mono (format wymagany przez Whisper)

final class AudioCapture: @unchecked Sendable {
    static let sampleRate: Double = 16_000

    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var samples: [Float] = []
    private let target = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                       sampleRate: AudioCapture.sampleRate,
                                       channels: 1, interleaved: false)!

    func start() throws {
        lock.lock(); samples.removeAll(keepingCapacity: true); lock.unlock()

        let input = engine.inputNode
        let inFormat = input.outputFormat(forBus: 0)
        guard let converter = AVAudioConverter(from: inFormat, to: target) else {
            throw NSError(domain: "LiveScribe", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Nie można przekonwertować audio z mikrofonu"])
        }
        let target = self.target
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 4096, format: inFormat) { [weak self] buffer, _ in
            let ratio = target.sampleRate / buffer.format.sampleRate
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
            guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
            var consumed = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if consumed { status.pointee = .noDataNow; return nil }
                consumed = true
                status.pointee = .haveData
                return buffer
            }
            guard error == nil, let ch = out.floatChannelData else { return }
            let chunk = Array(UnsafeBufferPointer(start: ch[0], count: Int(out.frameLength)))
            self?.append(chunk)
        }
        engine.prepare()
        try engine.start()
    }

    private func append(_ chunk: [Float]) {
        lock.lock(); samples.append(contentsOf: chunk); lock.unlock()
    }

    func snapshot() -> [Float] {
        lock.lock(); defer { lock.unlock() }
        return samples
    }

    @discardableResult
    func stop() -> [Float] {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        return snapshot()
    }
}

// MARK: - Silnik Whisper: podgląd co ~1 s + pełna transkrypcja na końcu

@MainActor
final class WhisperEngine: SpeechEngine {
    var onPartial: ((String) -> Void)?

    /// Nagranie ostatniej sesji – do trybu „Whisper translate”.
    private(set) var lastAudio: [Float] = []

    private let capture = AudioCapture()
    private var previewLoop: Task<Void, Never>?
    private var language = "pl"
    private var model: String { AppSettings.whisperModel }

    func start(localeID: String) throws {
        cancel()
        language = Languages.code(for: localeID)
        lastAudio = []
        try capture.start()

        let model = self.model
        let language = self.language
        previewLoop = Task { [weak self] in
            var lastCount = 0
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 900_000_000)
                guard let self, !Task.isCancelled else { return }
                let audio = self.capture.snapshot()
                // min. 0,5 s nowego dźwięku od poprzedniego podglądu
                guard audio.count - lastCount > Int(AudioCapture.sampleRate / 2) else { continue }
                lastCount = audio.count
                // Podgląd: ostatnie 30 s (jedno okno Whisper) – stały koszt niezależnie od długości.
                let window = Array(audio.suffix(Int(AudioCapture.sampleRate * 30)))
                if let text = try? await WhisperService.shared.run(window, model: model, language: language, task: .transcribe),
                   !Task.isCancelled, !text.isEmpty {
                    self.onPartial?(text)
                }
            }
        }
    }

    func stop() async throws -> String {
        let audio = capture.stop()
        previewLoop?.cancel()
        previewLoop = nil
        lastAudio = audio
        guard audio.count > Int(AudioCapture.sampleRate / 4) else { return "" }
        return try await WhisperService.shared.run(audio, model: model, language: language, task: .transcribe)
    }

    func cancel() {
        previewLoop?.cancel()
        previewLoop = nil
        capture.stop()
    }

    /// Mowa (PL) → tekst angielski bezpośrednio przez Whisper.
    func translateLastToEnglish() async throws -> String {
        try await WhisperService.shared.run(lastAudio, model: AppSettings.whisperTranslateModel,
                                            language: language, task: .translate)
    }
}
