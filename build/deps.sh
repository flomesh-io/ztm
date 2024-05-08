#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

cd "$ZTM_DIR"
git submodule update --init

cd "$ZTM_DIR/pipy"
npm install --no-audit

cd "$ZTM_DIR/gui"
npm install --no-audit
