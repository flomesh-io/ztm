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
otool -L /Users/lindongchen/Documents/HBuilderProjects/ztm/ztm/gui/src-tauri/gen/apple/Runner.app/Runner

输入 ~/Library/Developer/Xcode/DerivedData，然后删除该目录下的所有内容。
xcrun simctl list devices

xcrun simctl get_app_container "4C41487E-105E-4EC2-B072-2D83F5F5E71B" "com.flomesh.ztm" data
/Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application
find /Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application/0647839B-70A2-48CD-943F-234DFC732FE3 -name "libpipy.dylib"

/Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application/0647839B-70A2-48CD-943F-234DFC732FE3/Documents/libpipy.dylib