#!/bin/bash

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

check_version() {
  if [ `printf '%s\n%s' $1 $2 | sort -V | head -n1` = $1 ]; then
    echo $3
    exit 1
  fi
}

if ! command -v node &> /dev/null
then
  echo "Can't find node command, exit..."
  exit 1
fi

check_version `node -v` 'v16' 'Require Node.js version 16 or above'

cd "$ZTM_DIR/gui"
npm run build
npm run build:apps

rm -f "$ZTM_DIR/pipy/build/deps/codebases.tar.gz.h"
