#!/bin/bash

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)
ZTM_BIN="$ZTM_DIR/bin/ztm"

rm -rf $ZTM_DIR/pipy/build

mkdir -p "$ZTM_DIR/pipy/build"
cd "$ZTM_DIR/pipy/build"

if [ -z "$BUILD_ZTM_SHARED" ]
then
  cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_COMPILER=clang \
    -DCMAKE_CXX_COMPILER=clang++ \
    -DPIPY_GUI=OFF \
    -DPIPY_CODEBASES=ON \
    -DPIPY_CUSTOM_CODEBASES=ztm/ca:../ca,ztm/hub:../hub,ztm/agent:../agent,ztm/cli:../cli \
    -DPIPY_DEFAULT_OPTIONS="repo://ztm/cli --args"

  make -j2

  mkdir -p "$ZTM_DIR/bin"
  rm -f "$ZTM_BIN"
  cp -f "$ZTM_DIR/pipy/bin/pipy" "$ZTM_BIN"

  echo "The final product is ready at $ZTM_BIN"
else
  export PIPY_DIR=${ZTM_DIR}/pipy
  if [ -z "$NDK"  ] || [ ! -f "$NDK/build/cmake/android.toolchain.cmake" ]
  then
    echo "Can't find NDK, exists..."
    exit 1
  fi

  export ANDROID_NDK_ROOT=$NDK

#### Build OpenSSL
  cd $PIPY_DIR/deps/openssl-3.2.0

  mkdir -p android && cd android

  ANDROID_TARGET_API=34
  ANDROID_TARGET_ABI=arm64-v8a

  OUTPUT=${PWD}/${ANDROID_TARGET_ABI}

  PATH=$ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH
  ../config android-arm64 -D__ANDROID_API__=${ANDROID_TARGET_API} -fPIC -static no-asm no-shared no-tests --prefix=${OUTPUT}

  make
  make install_sw

#### Build libztm.so
  cd $PIPY_DIR/build

  cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=${NDK}/build/cmake/android.toolchain.cmake \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_PLATFORM=android-34 \
    -DCMAKE_ANDROID_STL_TYPE=c++_static \
    -DCMAKE_MAKE_PROGRAM=ninja \
    -DANDROID_ALLOW_UNDEFINED_SYMBOLS=TRUE \
    -DPIPY_OPENSSL=${ZTM_DIR}/pipy/deps/openssl-3.2.0/android/arm64-v8a \
    -DPIPY_USE_SYSTEM_ZLIB=ON \
    -DZLIB_LIBRARY=/usr/lib/x86_64-linux-gnu/libz.a -DZLIB_INCLUDE_DIR=/usr/lib/x86_64-linux-gnu \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
    -DPIPY_SHARED=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DPIPY_GUI=OFF \
    -DPIPY_CODEBASES=ON \
    -DPIPY_CUSTOM_CODEBASES=ztm/ca:../ca,ztm/hub:../hub,ztm/agent:../agent,ztm/cli:../cli \
    -DPIPY_DEFAULT_OPTIONS="repo://ztm/cli --args" \
    -GNinja 

  ninja

  if [ $? -ne 0 ]
  then
    echo "libztm.so build failed, exit..."
    exit 1
  fi

  cd $ZTM_DIR

  mkdir -p usr/local/lib
  cp $ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so $ZTM_DIR/usr/local/lib
  cp $PIPY_DIR/build/libpipy.so $ZTM_DIR/usr/local/lib/libztm.so

  echo "The libztm.so is ready at $ZTM_DIR/usr/local/lib/libztm.so"
fi

if [ -n "$PACKAGE_OUTPUT" ]
then
  cd $ZTM_DIR

  if [ ! -f version.env ]
  then
    echo "Missing version info, skip package..."
    exit 0
  fi

  bin/ztm version

  source version.env

  if [ -z "$BUILD_ZTM_SHARED" ]
  then
    tar zcvf ztm-cli-${VERSION}-${OS_NAME}-${OS_ARCH}.tar.gz bin/ztm
  else
    tar zcvf libztm-${VERSION}-android.tar.gz usr/local/lib/*.so
  fi
fi
