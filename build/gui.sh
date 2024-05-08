#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

cd "$ZTM_DIR/gui"
npm run build
