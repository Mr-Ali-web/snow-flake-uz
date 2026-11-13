import AppKit
import SpriteKit

final class FlakeScene: SKScene {
    private let screenFrame: CGRect
    private struct Flake {
        let node: SKShapeNode
        var velocity: CGVector
        let depth: CGFloat
        let radius: CGFloat
    }
    private var flakes: [Flake] = []
    private var windowRects: [CGRect] = []
    private var cursor = CGPoint(x: -10000, y: -10000)
    private var elapsed: CGFloat = 0
    private var lastTime: TimeInterval = 0
    private let aurora = SKShapeNode(rectOf: .zero)
    private let frostNodes = (0..<4).map { _ in SKShapeNode() }
    private var pileNodes: [Int: SKShapeNode] = [:]
    private var pileProfiles: [Int: [CGFloat]] = [:]
    private let countdown = SKLabelNode(fontNamed: "SF Pro Rounded Semibold")
    private let plow = SKShapeNode()
    private var plowX: CGFloat = -100
    private var snowEnabled = true
    private var auroraEnabled = true
    private var frostEnabled = true
    private var countdownEnabled = true
    private var autoPlowEnabled = true
    private var targetDensity = 170
    private var windStrength: CGFloat = 1
    private var forcePlow = false

    init(size: CGSize, screenFrame: CGRect) {
        self.screenFrame = screenFrame
        super.init(size: size)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func didMove(to view: SKView) {
        backgroundColor = .clear
        scaleMode = .resizeFill
        anchorPoint = CGPoint(x: 0, y: 0)
        aurora.fillColor = .clear
        aurora.strokeColor = .clear
        aurora.zPosition = 1
        addChild(aurora)
        for node in frostNodes { node.fillColor = .clear; node.strokeColor = .clear; node.zPosition = 8; addChild(node) }
        countdown.fontSize = 14
        countdown.fontColor = NSColor.white.withAlphaComponent(0.76)
        countdown.horizontalAlignmentMode = .right
        countdown.verticalAlignmentMode = .bottom
        countdown.zPosition = 20
        addChild(countdown)
        setupPlow()
        for _ in 0..<targetDensity { spawnFlake() }
    }

    func configure(snow: Bool, aurora: Bool, frost: Bool, countdown: Bool, autoPlow: Bool, density: Int, wind: Int) {
        snowEnabled = snow; auroraEnabled = aurora; frostEnabled = frost; countdownEnabled = countdown
        autoPlowEnabled = autoPlow; targetDensity = density; windStrength = CGFloat(wind)
        if !auroraEnabled { self.aurora.path = nil }
        if !frostEnabled { frostNodes.forEach { $0.path = nil } }
        self.countdown.isHidden = !countdownEnabled
        while flakes.count > targetDensity { flakes.removeLast().node.removeFromParent() }
    }

    func clearSnow() {
        pileNodes.values.forEach { $0.removeFromParent() }
        pileNodes.removeAll(); pileProfiles.removeAll()
    }
    func sendPlow() { plowX = -35; forcePlow = true }

    func updateEnvironment(cursor: CGPoint, windows: [CGRect]) {
        let mainHeight = NSScreen.screens.first(where: { $0.frame.origin == .zero })?.frame.height ?? NSScreen.main?.frame.height ?? size.height
        self.cursor = CGPoint(x: cursor.x - screenFrame.minX, y: mainHeight - cursor.y - screenFrame.minY)
        // Convert Quartz top-left coordinates to this screen's SpriteKit bottom-left coordinate system.
        windowRects = windows.compactMap { r in
            let local = CGRect(x: r.minX - screenFrame.minX, y: mainHeight - r.maxY - screenFrame.minY, width: r.width, height: r.height)
            return local.intersects(CGRect(origin: .zero, size: size)) ? local : nil
        }
    }

    override func update(_ currentTime: TimeInterval) {
        let dt = CGFloat(min(1.0 / 30.0, currentTime - (lastTime == 0 ? currentTime : lastTime)))
        lastTime = currentTime
        elapsed += dt
        if auroraEnabled { drawAurora() }
        if frostEnabled { drawFrost() }
        if countdownEnabled { updateCountdown() }
        updateFlakes(dt)
        updatePiles()
        updatePlow(dt)
    }

    private func spawnFlake() {
        let depth = CGFloat.random(in: 0...1)
        let radius = 0.8 + depth * 3.8
        let node = depth > 0.42 ? SKShapeNode(path: crystalPath(radius: radius)) : SKShapeNode(circleOfRadius: radius)
        node.fillColor = NSColor(white: 1, alpha: 0.28 + depth * 0.54)
        node.strokeColor = depth > 0.48 ? NSColor.white.withAlphaComponent(0.42) : .clear
        node.lineWidth = 0.6
        node.glowWidth = depth > 0.78 ? radius * 2.2 : 0
        node.zPosition = 2 + depth * 5
        node.position = CGPoint(x: CGFloat.random(in: 0...max(1, size.width)), y: size.height + radius)
        addChild(node)
        flakes.append(Flake(node: node, velocity: CGVector(dx: CGFloat.random(in: -13...13), dy: CGFloat.random(in: 24...55) * (0.4 + depth)), depth: depth, radius: radius))
    }

    private func crystalPath(radius: CGFloat) -> CGPath {
        let path = CGMutablePath()
        for arm in 0..<6 {
            let angle = CGFloat(arm) * .pi / 3
            let ux = cos(angle), uy = sin(angle)
            path.move(to: CGPoint(x: -ux * radius, y: -uy * radius))
            path.addLine(to: CGPoint(x: ux * radius, y: uy * radius))
            for fraction: CGFloat in [0.36, 0.60] {
                let x = ux * radius * fraction, y = uy * radius * fraction
                let branch = radius * 0.28
                for side: CGFloat in [-1, 1] {
                    let bx = cos(angle + side * .pi / 3) * branch
                    let by = sin(angle + side * .pi / 3) * branch
                    path.move(to: CGPoint(x: x, y: y))
                    path.addLine(to: CGPoint(x: x + bx, y: y + by))
                }
            }
        }
        return path
    }

    private func updateFlakes(_ dt: CGFloat) {
        guard snowEnabled else { return }
        for i in flakes.indices {
            let f = flakes[i]
            let p = f.node.position
            let sway = sin(elapsed * (0.7 + f.depth) + p.y * 0.014) * (7 + f.depth * 12)
            var next = CGPoint(x: p.x + (f.velocity.dx * windStrength + sway) * dt, y: p.y - f.velocity.dy * dt)
            // Cursor wake provides responsive scattering without intercepting the user's clicks.
            let dx = next.x - cursor.x, dy = next.y - cursor.y
            let d2 = dx * dx + dy * dy
            if d2 < 58 * 58 {
                let d = max(1, sqrt(d2)); let force = (1 - d / 58) * 240 * dt
                next.x += dx / d * force; next.y += dy / d * force
            }
            var landed = false
            for (index, rect) in windowRects.enumerated() where next.x >= rect.minX && next.x <= rect.maxX && p.y >= rect.maxY && next.y <= rect.maxY {
                let key = index
                let pile = pileNodes[key] ?? makePile(key: key, width: rect.width)
                var profile = pileProfiles[key] ?? Array(repeating: CGFloat(0), count: max(2, Int(rect.width / 12)))
                let bin = min(profile.count - 1, max(0, Int((next.x - rect.minX) / max(1, rect.width) * CGFloat(profile.count))))
                profile[bin] = min(24, profile[bin] + 0.16 + f.depth * 0.10)
                if bin > 0 { profile[bin - 1] = min(24, profile[bin - 1] + 0.035) }
                if bin + 1 < profile.count { profile[bin + 1] = min(24, profile[bin + 1] + 0.035) }
                pileProfiles[key] = profile
                pile.position = CGPoint(x: rect.minX, y: rect.maxY + 2)
                pile.path = pilePath(width: rect.width, profile: profile)
                landed = true
                break
            }
            if landed { f.node.removeFromParent(); f.node.position.y = -1000 }
            else if next.y < -12 { f.node.removeFromParent(); f.node.position = CGPoint(x: CGFloat.random(in: 0...max(1, size.width)), y: size.height + 8) }
            else { f.node.position = next }
            flakes[i] = f
        }
        flakes.removeAll { $0.node.parent == nil }
        while flakes.count < targetDensity { spawnFlake() }
    }

    private func makePile(key: Int, width: CGFloat) -> SKShapeNode {
        let n = SKShapeNode(); n.fillColor = NSColor(white: 0.92, alpha: 0.72); n.strokeColor = NSColor.white.withAlphaComponent(0.46); n.lineWidth = 1; n.zPosition = 10
        n.userData = NSMutableDictionary(); n.userData?["load"] = CGFloat(0); addChild(n); pileNodes[key] = n; return n
    }
    private func pilePath(width: CGFloat, profile: [CGFloat]) -> CGPath {
        let p = CGMutablePath(); p.move(to: .zero)
        for i in profile.indices {
            let x = width * CGFloat(i) / CGFloat(max(1, profile.count - 1))
            let loose = sin(elapsed * 1.8 + CGFloat(i) * 0.19) * 0.45
            p.addLine(to: CGPoint(x: x, y: max(1, profile[i] + 1.2 + loose)))
        }
        p.addLine(to: CGPoint(x: width, y: 0)); p.closeSubpath(); return p
    }
    private func updatePiles() {
        for (index, rect) in windowRects.enumerated() { if let pile = pileNodes[index], let profile = pileProfiles[index] { pile.position = CGPoint(x: rect.minX, y: rect.maxY + 2); pile.path = pilePath(width: rect.width, profile: profile) } }
    }

    private func drawAurora() {
        let rect = CGRect(x: 0, y: size.height - 125, width: size.width, height: 125)
        let path = CGMutablePath(); path.move(to: CGPoint(x: 0, y: size.height)); path.addLine(to: CGPoint(x: 0, y: size.height - 100))
        for i in 0...28 { let x = size.width * CGFloat(i) / 28; let y = size.height - 92 + sin(elapsed * 0.22 + CGFloat(i) * 0.34) * 18; path.addLine(to: CGPoint(x: x, y: y)) }
        path.addLine(to: CGPoint(x: size.width, y: size.height)); path.closeSubpath(); aurora.path = path; aurora.fillColor = NSColor(calibratedRed: 0.30, green: 0.68, blue: 0.77, alpha: 0.035 + 0.012 * sin(elapsed * 0.35)); aurora.glowWidth = 36
        _ = rect
    }

    private func drawFrost() {
        let corners = [CGPoint(x: 0, y: size.height), CGPoint(x: size.width, y: size.height), CGPoint(x: size.width, y: 0), CGPoint(x: 0, y: 0)]
        for (i, node) in frostNodes.enumerated() {
            let c = corners[i]; let dx = cursor.x - c.x, dy = cursor.y - c.y; let cleared = dx*dx + dy*dy < 155*155
            let p = CGMutablePath(); p.move(to: c)
            for j in 1...20 { let t = CGFloat(j) / 20; let x = c.x == 0 ? t * 125 : size.width - t * 125; let y = c.y == 0 ? t * 85 : size.height - t * 85; p.addLine(to: CGPoint(x: x + sin(CGFloat(j) * 3.1) * 8, y: y + cos(CGFloat(j) * 2.4) * 6)) }
            node.path = p; node.strokeColor = cleared ? .clear : NSColor(white: 0.91, alpha: 0.24); node.lineWidth = 1.2; node.glowWidth = cleared ? 0 : 7
        }
    }
    private func updateCountdown() {
        var calendar = Calendar.current; calendar.timeZone = .current
        let now = Date(); let year = calendar.component(.year, from: now) + 1
        let target = calendar.date(from: DateComponents(year: year, month: 1, day: 1)) ?? now
        let parts = calendar.dateComponents([.day, .hour, .minute, .second], from: now, to: target)
        countdown.text = String(format: "✦  NEW YEAR  %dd  %02dh  %02dm  %02ds", parts.day ?? 0, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0)
        countdown.position = CGPoint(x: size.width - 28, y: 28)
    }
    private func setupPlow() {
        let p = CGMutablePath(); p.move(to: CGPoint(x: -18,y: 0)); p.addLine(to: CGPoint(x: 17,y: 0)); p.addLine(to: CGPoint(x: 12,y: 13)); p.addLine(to: CGPoint(x: -13,y: 13)); p.closeSubpath()
        plow.path = p; plow.fillColor = NSColor(calibratedRed: 0.86, green: 0.28, blue: 0.20, alpha: 0.92); plow.strokeColor = .white.withAlphaComponent(0.8); plow.zPosition = 15; plow.isHidden = true; addChild(plow)
    }
    private func updatePlow(_ dt: CGFloat) {
        let load = pileProfiles.values.reduce(CGFloat(0)) { total, profile in total + profile.reduce(0, +) }
        guard forcePlow || (autoPlowEnabled && load > 30) else { plow.isHidden = true; return }
        plow.isHidden = false; plowX += 125 * dt
        if plowX > size.width + 30 { plowX = -30; forcePlow = false }
        plow.position = CGPoint(x: plowX, y: 15 + sin(elapsed * 9) * 1.5)
        for (key, pile) in pileNodes {
            let dx = pile.position.x - plowX
            if abs(dx) < 38, var profile = pileProfiles[key] {
                let index = min(profile.count - 1, max(0, Int((plowX - pile.position.x) / max(1, (windowRects.indices.contains(key) ? windowRects[key].width : size.width)) * CGFloat(profile.count))))
                for i in max(0, index - 3)...min(profile.count - 1, index + 3) { profile[i] = max(0, profile[i] - 0.35) }
                pileProfiles[key] = profile
            }
        }
    }
}
