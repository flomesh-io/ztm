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
iPhone 15 (71ABD7E4-1734-4D89-8FFD-262A97845005) (Shutdown) 
iPhone 15 Plus (1A5866F6-4B3B-4526-BEB9-D23066CE74B0) (Booted) 
iPhone 15 Pro (4C41487E-105E-4EC2-B072-2D83F5F5E71B) (Shutdown) 
iPhone 15 Pro Max (71C091BA-BC39-4B5A-BCD2-F9049D182BC5) (Shutdown) 
iPad (10th generation) (6FFFE8A4-C24B-4493-B38C-2BD0A10FB45B) (Shutdown) 
iPad mini (6th generation) (F1A1D91B-43EB-49D0-90FB-D246F4AF661D) (Shutdown) 
iPad Air 11-inch (M2) (1BF18BA6-73FD-4B02-BF88-8B21FF63AD96) (Shutdown) 
iPad Air 13-inch (M2) (B36F4D30-8DAC-4A6B-B773-04A5B3B91C73) (Shutdown) 
iPad Pro 11-inch (M4) (CF4EFA89-A54B-4E44-8821-FC667E029348) (Shutdown) 
iPad Pro 13-inch (M4) (B02656E7-B06E-4F0C-AE4E-9A580CE29E4D) (Shutdown) 

xcrun simctl get_app_container "1A5866F6-4B3B-4526-BEB9-D23066CE74B0" "com.flomesh.ztm" data
/Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application
find /Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application/0647839B-70A2-48CD-943F-234DFC732FE3 -name "libpipy.dylib"

/Users/lindongchen/Library/Developer/CoreSimulator/Devices/4C41487E-105E-4EC2-B072-2D83F5F5E71B/data/Containers/Data/Application/0647839B-70A2-48CD-943F-234DFC732FE3/Documents/libpipy.dylib