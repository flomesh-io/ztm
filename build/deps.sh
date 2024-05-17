#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

cd "$ZTM_DIR"
git submodule update --init

cd "$ZTM_DIR/pipy"
rm -f build/deps/codebases.tar.gz.h
npm install --no-audit

cd "$ZTM_DIR/gui"
npm install --no-audit
