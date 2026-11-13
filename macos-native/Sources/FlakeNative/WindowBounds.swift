import AppKit
import CoreGraphics

enum WindowBounds {
    /// Returns visible, ordinary level windows in global Quartz coordinates.
    /// Screen Recording permission may be required on recent macOS versions.
    static func visibleWindowRects() -> [CGRect] {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return [] }
        let ownPID = ProcessInfo.processInfo.processIdentifier
        return list.compactMap { info in
            guard (info[kCGWindowOwnerPID as String] as? pid_t) != ownPID,
                  (info[kCGWindowLayer as String] as? Int) == 0,
                  (info[kCGWindowAlpha as String] as? CGFloat ?? 1) > 0.02,
                  let bounds = info[kCGWindowBounds as String] as? [String: CGFloat],
                  let x = bounds["X"], let y = bounds["Y"],
                  let w = bounds["Width"], let h = bounds["Height"], w > 80, h > 30 else { return nil }
            return CGRect(x: x, y: y, width: w, height: h)
        }
    }
}
