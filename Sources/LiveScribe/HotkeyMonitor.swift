import AppKit

/// Globalny skrót oparty o klawisz modyfikujący (np. prawy Option), jak w Handy.
/// Wymaga uprawnienia „Dostępność” (Accessibility).
/// Docs: https://developer.apple.com/documentation/appkit/nsevent/1535472-addglobalmonitorforevents
@MainActor
final class HotkeyMonitor {
    var onPress: (() -> Void)?
    var onRelease: (() -> Void)?

    private var globalMonitor: Any?
    private var localMonitor: Any?
    private var isDown = false

    func start() {
        stop()
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            let code = event.keyCode
            let flags = event.modifierFlags
            Task { @MainActor in self?.handle(keyCode: code, flags: flags) }
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            let code = event.keyCode
            let flags = event.modifierFlags
            Task { @MainActor in self?.handle(keyCode: code, flags: flags) }
            return event
        }
    }

    func stop() {
        if let m = globalMonitor { NSEvent.removeMonitor(m) }
        if let m = localMonitor { NSEvent.removeMonitor(m) }
        globalMonitor = nil
        localMonitor = nil
    }

    private func handle(keyCode: UInt16, flags: NSEvent.ModifierFlags) {
        let key = AppSettings.hotkeyKey
        guard keyCode == key.keyCode else { return }
        let pressed: Bool
        switch key {
        case .rightOption: pressed = flags.contains(.option)
        case .rightCommand: pressed = flags.contains(.command)
        case .rightControl: pressed = flags.contains(.control)
        case .fn: pressed = flags.contains(.function)
        }
        if pressed && !isDown {
            isDown = true
            onPress?()
        } else if !pressed && isDown {
            isDown = false
            onRelease?()
        }
    }
}
