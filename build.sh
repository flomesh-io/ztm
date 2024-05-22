#!/bin/sh

check_version() {
  if [ `printf '%s\n%s' $1 $2 | sort -V | head -n1` = $1 ]; then
    echo $3
    exit -1
  fi
}

check_version `node -v` 'v16' 'Require Node.js version 16 or above'

ZTM_DIR=$(cd "$(dirname "$0")" && pwd)
ZTM_BIN="$ZTM_DIR/bin/ztm"

cd "$ZTM_DIR"
build/deps.sh
build/gui.sh
build/pipy.sh

git submodule update --init

cd "$ZTM_DIR/pipy"
npm install --no-audit

cd "$ZTM_DIR/gui"
npm install --no-audit

mkdir -p "$ZTM_DIR/bin"
rm -f "$ZTM_BIN"
cp -f "$ZTM_DIR/pipy/bin/pipy" "$ZTM_BIN"

echo "The final product is ready at $ZTM_BIN"
