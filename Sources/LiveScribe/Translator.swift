import Foundation

enum TranslatorError: LocalizedError {
    case missingAPIKey
    case http(Int, String)
    case api(String)
    case refusal
    case cliNotFound
    case cli(String)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey: return "Brak klucza API – ustaw go w Ustawieniach."
        case .http(let code, let body): return "HTTP \(code): \(body.prefix(300))"
        case .api(let msg): return "Błąd API: \(msg)"
        case .refusal: return "Model odmówił tłumaczenia."
        case .cliNotFound: return "Nie znaleziono programu `claude`. Zainstaluj Claude Code i zaloguj się (`claude` → /login)."
        case .cli(let msg): return "Claude Code: \(msg.prefix(300))"
        }
    }
}

/// Tłumaczy tekst strumieniowo. `onUpdate` dostaje dotychczasowy (narastający) wynik.
protocol Translator {
    func translate(_ text: String, from: String, to: String,
                   onUpdate: @escaping @MainActor (String) -> Void) async throws -> String
}

enum TranslatorFactory {
    static func make() -> Translator {
        switch AppSettings.backend {
        case .api: return ClaudeAPITranslator()
        case .claudeCode: return ClaudeCodeTranslator()
        }
    }
}

enum Prompt {
    static func instructions(from: String, to: String) -> String {
        """
        You are a real-time interpreter for dictated speech. The text comes from speech recognition \
        in \(from) and may contain recognition errors or missing punctuation. Translate it into \(to). \
        Fix obvious recognition mistakes, keep the speaker's meaning and tone, and use natural punctuation. \
        Output ONLY the translated text — no quotes, no explanations, no preamble. \
        If the text is already in \(to), output it cleaned up.
        """
    }
}

// MARK: - Claude API (klucz API), raw HTTP + SSE
// Docs: https://platform.claude.com/docs/en/api/messages
//       https://platform.claude.com/docs/en/build-with-claude/streaming

struct ClaudeAPITranslator: Translator {
    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    /// Modele obsługujące server-side `fallbacks` przy odmowie (refusal).
    private func supportsFallbacks(_ model: String) -> Bool {
        ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-fable-5-2"].contains(model)
    }

    func translate(_ text: String, from: String, to: String,
                   onUpdate: @escaping @MainActor (String) -> Void) async throws -> String {
        guard let key = Keychain.load(), !key.isEmpty else { throw TranslatorError.missingAPIKey }
        let model = AppSettings.model

        var body: [String: Any] = [
            "model": model,
            "max_tokens": 4096,
            "stream": true,
            "system": Prompt.instructions(from: from, to: to),
            "messages": [["role": "user", "content": text]],
            // Tłumaczenie jest proste i wrażliwe na opóźnienia → niski effort.
            "output_config": ["effort": "low"],
        ]

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        if supportsFallbacks(model) {
            body["fallbacks"] = "default"
            req.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            var errBody = ""
            for try await line in bytes.lines { errBody += line }
            throw TranslatorError.http(status, errBody)
        }

        var output = ""
        for try await line in bytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data:") else { continue }
            let json = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let data = json.data(using: .utf8),
                  let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = event["type"] as? String else { continue }

            switch type {
            case "content_block_delta":
                if let delta = event["delta"] as? [String: Any],
                   delta["type"] as? String == "text_delta",
                   let piece = delta["text"] as? String {
                    output += piece
                    let snapshot = output
                    await onUpdate(snapshot)
                }
            case "message_delta":
                if let delta = event["delta"] as? [String: Any],
                   delta["stop_reason"] as? String == "refusal" {
                    throw TranslatorError.refusal
                }
            case "error":
                let msg = (event["error"] as? [String: Any])?["message"] as? String ?? "nieznany błąd"
                throw TranslatorError.api(msg)
            default:
                break
            }
        }
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Subskrypcja Claude przez Claude Code CLI (`claude -p`)
// Używa logowania z Twojej subskrypcji Pro/Max – bez klucza API.
// Docs: https://code.claude.com/docs/en/headless
//       https://code.claude.com/docs/en/cli-reference

struct ClaudeCodeTranslator: Translator {
    static func findCLI() -> String? {
        let custom = AppSettings.cliPath.trimmingCharacters(in: .whitespaces)
        if !custom.isEmpty { return FileManager.default.isExecutableFile(atPath: custom) ? custom : nil }

        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            "\(home)/.local/bin/claude",
            "\(home)/.claude/local/claude",
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
            "\(home)/.npm-global/bin/claude",
            "\(home)/.bun/bin/claude",
        ]
        if let hit = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) { return hit }

        // Ostatnia próba: zapytaj powłokę logowania użytkownika.
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", "command -v claude"]
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return nil }
        p.waitUntilExit()
        let path = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return path.isEmpty ? nil : path
    }

    func translate(_ text: String, from: String, to: String,
                   onUpdate: @escaping @MainActor (String) -> Void) async throws -> String {
        guard let cli = Self.findCLI() else { throw TranslatorError.cliNotFound }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: cli)
        process.arguments = [
            "-p",
            "--output-format", "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--model", AppSettings.model,
        ]
        // Pusty katalog roboczy – żeby nie wczytywać CLAUDE.md z jakiegoś projektu.
        let workDir = FileManager.default.temporaryDirectory.appendingPathComponent("LiveScribe", isDirectory: true)
        try? FileManager.default.createDirectory(at: workDir, withIntermediateDirectories: true)
        process.currentDirectoryURL = workDir

        var env = ProcessInfo.processInfo.environment
        env.removeValue(forKey: "ANTHROPIC_API_KEY") // wymuś logowanie subskrypcją
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        env["PATH"] = "\(home)/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:" + (env["PATH"] ?? "")
        process.environment = env

        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr

        let prompt = Prompt.instructions(from: from, to: to) + "\n\nText to translate:\n<<<\n\(text)\n>>>"

        return try await withTaskCancellationHandler {
            try process.run()
            stdin.fileHandleForWriting.write(Data(prompt.utf8))
            try? stdin.fileHandleForWriting.close()

            var output = ""
            var finalResult: String?
            for try await line in stdout.fileHandleForReading.bytes.lines {
                try Task.checkCancellation()
                guard let data = line.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let type = obj["type"] as? String else { continue }

                if type == "stream_event",
                   let event = obj["event"] as? [String: Any],
                   event["type"] as? String == "content_block_delta",
                   let delta = event["delta"] as? [String: Any],
                   delta["type"] as? String == "text_delta",
                   let piece = delta["text"] as? String {
                    output += piece
                    let snapshot = output
                    await onUpdate(snapshot)
                } else if type == "result" {
                    if obj["is_error"] as? Bool == true {
                        throw TranslatorError.cli(obj["result"] as? String ?? "błąd")
                    }
                    finalResult = obj["result"] as? String
                }
            }
            process.waitUntilExit()
            if let finalResult { return finalResult.trimmingCharacters(in: .whitespacesAndNewlines) }
            if process.terminationStatus != 0 {
                let err = String(data: stderr.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                throw TranslatorError.cli(err.isEmpty ? "kod wyjścia \(process.terminationStatus)" : err)
            }
            return output.trimmingCharacters(in: .whitespacesAndNewlines)
        } onCancel: {
            if process.isRunning { process.terminate() }
        }
    }
}
