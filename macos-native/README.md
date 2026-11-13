# Flake Native for macOS

This is a native macOS companion implementation of the Flake overlay. It uses AppKit for transparent desktop windows, SpriteKit for rendering, and CoreGraphics for screen-wide window bounds and cursor position. It is separate from the existing cross-platform Tauri application at the repository root.

## Run

Requires macOS 13 or later and Xcode Command Line Tools:

```sh
cd macos-native
swift run
```

To create a release executable:

```sh
swift build -c release
```

The app runs as an accessory app (no Dock icon). Quit it from Activity Monitor or terminate its process; packaging a signed `.app` with a menu-bar controller is a useful next distribution step.

## Structure

- `Sources/FlakeNative/AppMain.swift` creates one transparent, click-through, all-spaces overlay window per display.
- `Sources/FlakeNative/FlakeScene.swift` draws and animates the aurora, three apparent snow depths, window-edge accumulation, cursor wake, corner frost, New Year countdown, and automatic plow.
- `Sources/FlakeNative/WindowBounds.swift` reads on-screen window rectangles through `CGWindowListCopyWindowInfo`.

Use the snowflake in the menu bar to toggle snow, aurora, frost, the countdown, and automatic plowing. The same menu cycles snow density and wind strength, starts a manual plow pass, or clears all accumulated piles.

The overlay sets `ignoresMouseEvents = true`, so normal clicks always reach the app underneath. Snow reacts to the global cursor position; macOS cannot deliver a click to an individual particle while the same transparent window passes clicks through. Window bounds and cursor are sampled away from SpriteKit's render loop, and scene updates are dispatched to the main queue. Snow builds a per-window-edge height profile; the plow can be sent manually from the menu or run automatically after enough snow accumulates.

Window titles are not read. macOS can restrict window-list metadata depending on OS version and privacy settings; when bounds are unavailable, falling snow still renders but cannot accumulate on those windows.
