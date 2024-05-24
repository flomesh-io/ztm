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

cd "$ZTM_DIR"
git submodule update --init
if [ $? -ne 0 ]; then
  echo 'Cannot download Pipy from github.com'
  exit 1
fi

cd "$ZTM_DIR/pipy"
npm install --no-audit

cd "$ZTM_DIR/gui"
npm install --no-audit

cd "$ZTM_DIR"

if [ -n "$ZTM_VERSION" ]; then
  VERSION="$ZTM_VERSION"
else
  VERSION=`git describe --abbrev=0 --tags`
fi

COMMIT=`git log -1 --format=%H`
COMMIT_DATE=`git log -1 --format=%cD`

VERSION_JSON="{
  \"version\": \"$VERSION\",
  \"commit\": \"$COMMIT\",
  \"date\": \"$COMMIT_DATE\"
}"

echo "$VERSION_JSON" > cli/version.json
echo "$VERSION_JSON" > agent/version.json

echo "VERSION=\"$VERSION\"" > version.env
echo "COMMIT=\"$COMMIT\"" >> version.env
echo "COMMIT_DATE=\"$COMMIT_DATE\"" >> version.env
