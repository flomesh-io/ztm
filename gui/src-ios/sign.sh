#!/bin/bash

# 检查是否提供了 DMG 路径
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo "Usage: $0 <path-to-dmg-file> <apple-id> <apple-password>"
  exit 1
fi

DMG_PATH="$1"
TMP_DIR="/tmp/dmg-content"
NEW_DMG_PATH="$(dirname "$DMG_PATH")/$(basename "$DMG_PATH" .dmg)_signed.dmg"
VOLUME_NAME="ztm"
MACOS_IDENTITY="Developer ID Application: Flomesh Limited (H38KYFAJ64)"
APPLE_ID="$2"
APPLE_PASSWORD="$3"
TEAM_ID="H38KYFAJ64"

echo "挂载 DMG 文件..."
# 挂载 DMG 文件
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH")
echo "挂载结果: $MOUNT_OUTPUT"

# 查找挂载点
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes/$VOLUME_NAME" | awk '{print $3}')
if [ -z "$MOUNT_POINT" ]; then
  echo "未能找到挂载点，请检查 DMG 文件和 VOLUME_NAME"
  exit 1
fi

echo "挂载点: $MOUNT_POINT"

# 确保清空临时目录
if [ -d "$TMP_DIR" ]; then
  echo "清空临时目录..."
  rm -rf "$TMP_DIR"
fi
mkdir -p "$TMP_DIR"

# 复制内容到临时目录
echo "复制内容到临时目录..."
ditto "$MOUNT_POINT" "$TMP_DIR"

echo "卸载 DMG 文件..."
# 卸载 DMG 文件
hdiutil detach "$MOUNT_POINT"

# 对二进制文件进行签名
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$TMP_DIR/ztm.app/Contents/MacOS/ztm"
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$TMP_DIR/ztm.app/Contents/MacOS/ztmctl"

# 重新创建 DMG 文件
hdiutil create -volname "$VOLUME_NAME" -srcfolder "$TMP_DIR" -ov -format UDZO "$NEW_DMG_PATH"

# 对新的 DMG 文件进行签名
codesign --deep --force --verify --verbose --options runtime --timestamp --sign "$MACOS_IDENTITY" "$NEW_DMG_PATH"

# 提交新的 DMG 文件进行公证
xcrun notarytool submit "$NEW_DMG_PATH" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$TEAM_ID" --wait
xcrun stapler staple "$NEW_DMG_PATH"

echo "DMG 文件已签名并公证完成：$NEW_DMG_PATH"
