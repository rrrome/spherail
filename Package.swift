// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InkBallMac",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "InkBallMac", targets: ["InkBallMac"])],
    targets: [
        .executableTarget(name: "InkBallMac", path: "Sources/InkBallMac"),
        .testTarget(name: "InkBallMacTests", dependencies: ["InkBallMac"], path: "Tests/InkBallMacTests")
    ]
)
