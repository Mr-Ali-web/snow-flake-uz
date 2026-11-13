// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlakeNative",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "FlakeNative", targets: ["FlakeNative"])],
    targets: [.executableTarget(name: "FlakeNative")]
)
