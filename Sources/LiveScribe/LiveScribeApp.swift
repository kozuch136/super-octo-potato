import SwiftUI

@main
struct LiveScribeApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        MenuBarExtra {
            Text(state.status)
            if let err = state.lastError {
                Text(err).foregroundStyle(.red)
            }
            Divider()
            Button(state.isRecording ? "Zatrzymaj" : "Rozpocznij dyktowanie") {
                state.toggleFromMenu()
            }
            if !state.translation.isEmpty {
                Button("Kopiuj ostatnie tłumaczenie") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(state.translation, forType: .string)
                }
            }
            Divider()
            SettingsLink { Text("Ustawienia…") }
                .keyboardShortcut(",")
            Button("Zakończ") { NSApplication.shared.terminate(nil) }
                .keyboardShortcut("q")
        } label: {
            Image(systemName: state.isRecording ? "waveform.circle.fill" : "waveform")
        }

        Settings {
            SettingsView()
        }
    }
}
