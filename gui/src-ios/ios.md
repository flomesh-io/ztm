1.
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
2.
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
3.
brew install cocoapods
4.
yarn tauri ios init

5.安装pipylib
chmod +x setup_lib.sh
/Users/lindongchen/Documents/HBuilderProjects/ztm/ztm/gui/src-ios/setup_lib.sh /Users/lindongchen/Documents/HBuilderProjects/ztm/ztm/gui/src-tauri/gen/apple /Users/lindongchen/Documents/HBuilderProjects/ztm/ztm/gui/src-tauri/gen/apple/Externals/arm64-sim/debug/libpipy.dylib
并验证
otool -L src-tauri/gen/apple/Runner.app/Runner