#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

mkdir -p "$ZTM_DIR/pipy/build"
cd "$ZTM_DIR/pipy/build"

cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++ \
  -DPIPY_GUI=OFF \
  -DPIPY_CODEBASES=ON \
  -DPIPY_CUSTOM_CODEBASES=ztm/ca:../ca,ztm/hub:../hub,ztm/agent:../agent

make
