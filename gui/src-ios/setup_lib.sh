#!/bin/bash

# 检查参数是否正确传入
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <PROJECT_DIR> <SOURCE_DYLIB_PATH>"
  exit 1
fi


# 变量定义
PROJECT_DIR=$1
SOURCE_DYLIB_PATH=$2
DYLIB_NAME=$(basename "$SOURCE_DYLIB_PATH")
XCODE_PROJECT_PATH="$PROJECT_DIR/Runner.xcodeproj"

# 将动态库复制到 Xcode 的 Frameworks 目录
cp "$SOURCE_DYLIB_PATH" "$PROJECT_DIR/"

# 配置 Xcode 项目
cd "$PROJECT_DIR"

# 添加 Run Script Phase 来确保动态库在构建时被复制
RUN_SCRIPT_PHASE="cp -R \"$PROJECT_DIR/$DYLIB_NAME\" \"\$TARGET_BUILD_DIR/\$FRAMEWORKS_FOLDER_PATH/\""

# 使用 xcodeproj 命令行工具添加 Run Script Phase
/usr/libexec/PlistBuddy -c "Add :targets:0:buildPhases:0:runScripts:0 script string \"$RUN_SCRIPT_PHASE\"" "$XCODE_PROJECT_PATH/project.pbxproj"

# 添加到 Link Binary With Libraries
/usr/libexec/PlistBuddy -c "Add :targets:0:buildPhases:0:files:0:buildFile fileRef string \"$DYLIB_NAME\"" "$XCODE_PROJECT_PATH/project.pbxproj"

echo "Xcode 项目配置完成"
