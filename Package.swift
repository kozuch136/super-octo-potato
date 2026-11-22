// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "LiveScribe",
    platforms: [.macOS(.v15)],
    dependencies: [
        // WhisperKit – Whisper na urządzeniu (Core ML). https://github.com/argmaxinc/argmax-oss-swift
        .package(url: "https://github.com/argmaxinc/argmax-oss-swift.git", from: "1.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "LiveScribe",
            dependencies: [
                .product(name: "WhisperKit", package: "argmax-oss-swift"),
            ],
            path: "Sources/LiveScribe"
        )
    ]
)
