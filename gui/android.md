1.Download and install Android Studio from the Android Developers website
2.
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
export OPENSSL_DIR='/opt/homebrew/Cellar/openssl@3/3.3.0'
3.
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
4
cmd
yarn tauri android init
yarn tauri android dev
yarn tauri build --target aarch64-linux-android

about
Error Failed to assemble APK: command ["/Users/developer/Projects/Tauri/app/src-tauri/gen/android/gradlew", "--project-dir", "/Users/developer/Projects/Tauri/app/src-tauri/gen/android"] exited with code 1
 ELIFECYCLE  Command failed with exit code 1.
delete the 
~/.cargo/registry
~/.gradle/caches
src-tauri/target/

brew install openssl@3