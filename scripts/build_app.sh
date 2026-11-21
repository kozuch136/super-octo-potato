#!/usr/bin/env bash
# Buduje LiveScribe.app (release) i podpisuje ad-hoc.
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN="$(swift build -c release --show-bin-path)/LiveScribe"

APP="build/LiveScribe.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/LiveScribe"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Podpis ad-hoc – wymagany, żeby macOS (TCC) zapamiętał uprawnienia mikrofonu/dostępności.
codesign --force --deep --sign - "$APP"

echo "Gotowe: $APP"
echo "Instalacja: cp -R \"$APP\" /Applications/ && open /Applications/LiveScribe.app"
