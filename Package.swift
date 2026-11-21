// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "LiveScribe",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "LiveScribe",
            path: "Sources/LiveScribe"
        )
    ]
)
