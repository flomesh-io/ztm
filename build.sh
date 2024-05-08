#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && pwd)
ZTM_BIN="$ZTM_DIR/bin/pipy"

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
cp "$ZTM_DIR/pipy/bin/pipy" "$ZTM_BIN"

echo "The final product is ready at $ZTM_BIN"
