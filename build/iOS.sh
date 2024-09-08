BUILD_SCRIPT_DIR=$(dirname "$(realpath $0)")
ZTM_DIR=$(dirname $BUILD_SCRIPT_DIR)
cd $ZTM_DIR

# check if xcode installed
xcodebuild -version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Please install xcode."
  eixt 1
fi

export IOS_SDK_VERSION=$(xcrun -sdk iphoneos --show-sdk-version)

# clone and build openssl-apple
pushd pipy
if [ -d openssl-apple ]; then
  pushd openssl-apple
  git pull
  git checkout v11
  popd
else
  git clone --branch v11 https://github.com/passepartoutvpn/openssl-apple.git
fi
pushd openssl-apple
CURL_OPTIONS="-L" ./build-libssl.sh --version=3.2.0 --targets="ios64-cross" --deprecated
if [ ! -f bin/iPhoneOS17.5-cross.sdk/lib/libssl.a ]; then
  echo "Build libssl for iOS failed."
  exit 1
fi

LIBSSL_PATH=$(realpath $PWD/bin/iPhoneOS${IOS_SDK_VERSION}-cross.sdk)
popd

# config pipy
rm -rf build && mkdir build
pushd build
cmake .. -DCMAKE_SYSTEM_NAME=iOS \
  -DPIPY_OPENSSL=${LIBSSL_PATH} \
  -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
  -DPIPY_STATICLIB=ON \
  -DCMAKE_BUILD_TYPE=Release \
  -DPIPY_GUI=OFF \
  -DPIPY_CODEBASES=ON \
  -DPIPY_CUSTOM_CODEBASES=ztm/ca:../ca,ztm/hub:../hub,ztm/agent:../agent,ztm/cli:../cli \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  -GXcode

if [ $? -ne 0 ]; then
  echo "Configure failed for ztm."
  exit 1
fi

# build libpipy.a
cmake --build .  --config Release -t pipy

if [ $? -ne 0 ]; then
  echo 'Compile libpipy.a failed.'
  exit 1
fi

if [ ! -d $ZTM_DIR/usr/local/lib ]; then
  mkdir -p $ZTM_DIR/usr/local/lib
fi

# copy all dependencies
echo "Copy deps"
find deps -name 'lib*.a' | xargs -I{} cp -v {} $ZTM_DIR/usr/local/lib
echo "Copy libpipy.a"
cp -v Release-iphoneos/libpipy.a $ZTM_DIR/usr/local/lib/
popd # to $ZTM_DIR/pipy

echo "Copy libssl"
find "${LIBSSL_PATH}" -name 'lib*.a' | xargs -I{} cp -v {} $ZTM_DIR/usr/local/lib

echo "The libs are ready at $ZTM_DIR/usr/local/lib"
ls -l $ZTM_DIR/usr/local/lib
