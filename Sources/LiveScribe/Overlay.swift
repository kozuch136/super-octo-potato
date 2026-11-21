import AppKit
import SwiftUI

/// Pływający panel na dole ekranu z transkrypcją i tłumaczeniem na żywo.
@MainActor
final class OverlayController {
    private let panel: NSPanel
    private var hideWork: DispatchWorkItem?

    init(state: AppState) {
        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 620, height: 170),
            styleMask: [.nonactivatingPanel, .borderless],
            backing: .buffered,
            defer: true
        )
        panel.level = .statusBar
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.ignoresMouseEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.contentView = NSHostingView(rootView: OverlayView().environmentObject(state))
    }

    func show() {
        hideWork?.cancel()
        if let screen = NSScreen.main {
            let f = screen.visibleFrame
            let size = panel.frame.size
            panel.setFrameOrigin(NSPoint(x: f.midX - size.width / 2, y: f.minY + 60))
        }
        panel.orderFrontRegardless()
    }

    func hide(after delay: TimeInterval = 0) {
        hideWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.panel.orderOut(nil) }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }
}

struct OverlayView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(state.isRecording ? Color.red : Color.secondary)
                    .frame(width: 8, height: 8)
                Text(state.status).font(.caption).foregroundStyle(.secondary)
                Spacer()
                if state.isTranslating { ProgressView().controlSize(.small) }
            }
            Text(state.transcript.isEmpty ? "Mów…" : state.transcript)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .truncationMode(.head)
            if AppSettings.outputMode != .original {
                Text(state.translation.isEmpty ? " " : state.translation)
                    .font(.title3.weight(.medium))
                    .lineLimit(3)
                    .truncationMode(.head)
            }
        }
        .padding(14)
        .frame(width: 620, height: 170, alignment: .topLeading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
