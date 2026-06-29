#!/bin/bash
# Switch to Xcode 16 for React Native / Expo local builds.
# RN 0.81.5 is not compatible with Xcode 26 — use this before npx expo run:ios.
set -e

XCODE16="/Applications/Xcode_16.app/Contents/Developer"

if [ ! -d "$XCODE16" ]; then
  echo "❌  Xcode 16 not found at $XCODE16"
  echo "   Download it from: https://developer.apple.com/download/all"
  echo "   Then rename it to Xcode_16.app and place it in /Applications"
  exit 1
fi

sudo xcode-select -s "$XCODE16"
echo "✅  $(xcodebuild -version | head -1) active"
echo "   Run 'npx expo run:ios' now, then ./scripts/use-xcode26.sh when done."
