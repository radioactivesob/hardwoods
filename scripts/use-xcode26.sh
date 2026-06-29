#!/bin/bash
# Switch back to Xcode 26 (default) after doing React Native builds.
set -e

XCODE26="/Applications/Xcode.app/Contents/Developer"

if [ ! -d "$XCODE26" ]; then
  echo "❌  Xcode not found at $XCODE26"
  exit 1
fi

sudo xcode-select -s "$XCODE26"
echo "✅  $(xcodebuild -version | head -1) active"
