import AppKit
import SpriteKit
import CoreGraphics

@main
enum FlakeNativeApp {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var overlays: [OverlayWindow] = []
    private var managers: [OverlayManager] = []
    private var statusItem: NSStatusItem!
    private var snowEnabled = true
    private var auroraEnabled = true
    private var frostEnabled = true
    private var countdownEnabled = true
    private var autoPlowEnabled = true
    private var density = 170
    private var wind = 1

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        rebuildScreens()
        NotificationCenter.default.addObserver(self, selector: #selector(rebuildScreens), name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    private func installMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.title = "❄︎"
        let menu = NSMenu()
        addToggle("Falling snow", tag: 1, to: menu)
        addToggle("Aurora", tag: 2, to: menu)
        addToggle("Corner frost", tag: 3, to: menu)
        addToggle("New Year countdown", tag: 4, to: menu)
        addToggle("Automatic snowplow", tag: 5, to: menu)
        menu.addItem(.separator())
        let densityItem = NSMenuItem(title: "Snow density: 170", action: #selector(cycleDensity), keyEquivalent: "")
        densityItem.target = self; densityItem.tag = 6; menu.addItem(densityItem)
        let windItem = NSMenuItem(title: "Wind: gentle", action: #selector(cycleWind), keyEquivalent: "")
        windItem.target = self; windItem.tag = 7; menu.addItem(windItem)
        menu.addItem(.separator())
        let plowItem = NSMenuItem(title: "Send snowplow now", action: #selector(sendPlow), keyEquivalent: "p")
        plowItem.target = self; menu.addItem(plowItem)
        let clearItem = NSMenuItem(title: "Clear accumulated snow", action: #selector(clearSnow), keyEquivalent: "")
        clearItem.target = self; menu.addItem(clearItem)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Flake", action: #selector(quit), keyEquivalent: "q")
        quit.target = self; menu.addItem(quit)
        statusItem.menu = menu
        syncMenu()
    }

    private func addToggle(_ title: String, tag: Int, to menu: NSMenu) {
        let item = NSMenuItem(title: title, action: #selector(toggleFeature(_:)), keyEquivalent: "")
        item.target = self; item.tag = tag; menu.addItem(item)
    }

    private func syncMenu() {
        for item in statusItem.menu?.items ?? [] {
            switch item.tag {
            case 1: item.state = snowEnabled ? .on : .off
            case 2: item.state = auroraEnabled ? .on : .off
            case 3: item.state = frostEnabled ? .on : .off
            case 4: item.state = countdownEnabled ? .on : .off
            case 5: item.state = autoPlowEnabled ? .on : .off
            case 6: item.title = "Snow density: \(density)"
            case 7: item.title = "Wind: \(["calm", "gentle", "breezy"][wind])"
            default: break
            }
        }
    }

    @objc private func toggleFeature(_ sender: NSMenuItem) {
        switch sender.tag {
        case 1: snowEnabled.toggle()
        case 2: auroraEnabled.toggle()
        case 3: frostEnabled.toggle()
        case 4: countdownEnabled.toggle()
        case 5: autoPlowEnabled.toggle()
        default: return
        }
        applySettings(); syncMenu()
    }
    @objc private func cycleDensity() { density = density == 80 ? 170 : (density == 170 ? 280 : 80); applySettings(); syncMenu() }
    @objc private func cycleWind() { wind = (wind + 1) % 3; applySettings(); syncMenu() }
    @objc private func sendPlow() { overlays.forEach { $0.scene.sendPlow() } }
    @objc private func clearSnow() { overlays.forEach { $0.scene.clearSnow() } }
    @objc private func quit() { NSApp.terminate(nil) }
    private func applySettings() {
        overlays.forEach { $0.scene.configure(snow: snowEnabled, aurora: auroraEnabled, frost: frostEnabled, countdown: countdownEnabled, autoPlow: autoPlowEnabled, density: density, wind: wind) }
    }

    @objc private func rebuildScreens() {
        overlays.forEach { $0.close() }
        overlays.removeAll()
        managers.removeAll()
        for screen in NSScreen.screens {
            let window = OverlayWindow(screen: screen)
            let manager = OverlayManager(scene: window.scene)
            window.scene.configure(snow: snowEnabled, aurora: auroraEnabled, frost: frostEnabled, countdown: countdownEnabled, autoPlow: autoPlowEnabled, density: density, wind: wind)
            overlays.append(window)
            managers.append(manager)
            window.orderFrontRegardless()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

final class OverlayWindow: NSWindow {
    let scene: FlakeScene

    init(screen: NSScreen) {
        scene = FlakeScene(size: screen.frame.size, screenFrame: screen.frame)
        super.init(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false, screen: screen)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = true
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        let view = SKView(frame: NSRect(origin: .zero, size: screen.frame.size))
        view.allowsTransparency = true
        view.wantsLayer = true
        view.layer?.backgroundColor = .clear
        view.preferredFramesPerSecond = 60
        view.presentScene(scene)
        contentView = view
    }
}

final class OverlayManager {
    private var timer: DispatchSourceTimer?
    init(scene: FlakeScene) {
        timer = DispatchSource.makeTimerSource(queue: .global(qos: .utility))
        timer?.schedule(deadline: .now(), repeating: .milliseconds(100))
        timer?.setEventHandler { [weak scene] in
            let cursor = CGEvent(source: nil)?.location ?? .zero
            let rects = WindowBounds.visibleWindowRects()
            DispatchQueue.main.async { scene?.updateEnvironment(cursor: cursor, windows: rects) }
        }
        timer?.resume()
    }
    deinit { timer?.cancel() }
}
