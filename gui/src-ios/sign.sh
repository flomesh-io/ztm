#!/bin/bash

# check params
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
  echo "Usage: $0 <path-to-dmg-file> <apple-id> <apple-password> <teamid>"
  exit 1
fi

DMG_PATH="$1"
TMP_DIR="/tmp/dmg-content"
NEW_DMG_PATH="$(dirname "$DMG_PATH")/$(basename "$DMG_PATH" .dmg)_signed.dmg"
VOLUME_NAME="ztm"
TEAM_ID="$4"
MACOS_IDENTITY="Developer ID Application: Flomesh Limited ($TEAM_ID)"
APPLE_ID="$2"
APPLE_PASSWORD="$3"

echo "MOUNT DMG..."
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH")
echo "MOUNTED: $MOUNT_OUTPUT"

MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes/$VOLUME_NAME" | awk '{print $3}')
if [ -z "$MOUNT_POINT" ]; then
  echo "Not Find, Please DMG and VOLUME_NAME"
  exit 1
fi

echo "MOUNT: $MOUNT_POINT"

if [ -d "$TMP_DIR" ]; then
  echo "clear dir..."
  rm -rf "$TMP_DIR"
fi
mkdir -p "$TMP_DIR"

echo "copy dir..."
ditto "$MOUNT_POINT" "$TMP_DIR"
hdiutil detach "$MOUNT_POINT"

# codesign
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$TMP_DIR/ztm.app/Contents/MacOS/ztm"
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$TMP_DIR/ztm.app/Contents/MacOS/ztmctl"
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$TMP_DIR/ztm.app"


# recreate DMG
hdiutil create -volname "$VOLUME_NAME" -srcfolder "$TMP_DIR" -ov -format UDZO "$NEW_DMG_PATH"

# codesign DMG 
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$NEW_DMG_PATH"

# submit DMG to xcrun
xcrun notarytool submit "$NEW_DMG_PATH" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$TEAM_ID" --wait

echo "stapling .app..."
xcrun stapler staple "$TMP_DIR/ztm.app"
xcrun stapler staple "$NEW_DMG_PATH"

echo "valid .app..."
spctl --assess --verbose=4 "$TMP_DIR/ztm.app"

echo "valid DMG..."
spctl --assess --verbose=4 "$NEW_DMG_PATH"

echo "Done：$NEW_DMG_PATH"
