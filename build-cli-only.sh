#!/bin/bash

ZTM_DIR=$(cd "$(dirname "$0")" && pwd)

cd "$ZTM_DIR"
git clean -X -f agent

cd "$ZTM_DIR"
build/deps.sh

if [ $? -ne 0 ]; then
  echo "Prepare deps failed, exit..."
  exit 1
fi

cd "$ZTM_DIR"
build/pipy.sh
