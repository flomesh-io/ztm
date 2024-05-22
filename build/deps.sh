#!/bin/sh

ZTM_DIR=$(cd "$(dirname "$0")" && cd .. && pwd)

cd "$ZTM_DIR"
git submodule update --init
if [ $? -ne 0 ]; then
  echo 'Cannot download Pipy from github.com'
  exit 1
fi

cd "$ZTM_DIR/pipy"
rm -f build/deps/codebases.tar.gz.h
npm install --no-audit

cd "$ZTM_DIR/gui"
npm install --no-audit

cd "$ZTM_DIR"

if [ -n "$CI_COMMIT_SHA" ]; then
  VERSION="$CI_COMMIT_TAG"
  COMMIT="$CI_COMMIT_SHA"
  COMMIT_DATE="$CI_COMMIT_DATE"
else
  VERSION=`git describe --abbrev=0 --tags`
  COMMIT=`git log -1 --format=%H`
  COMMIT_DATE=`git log -1 --format=%cD`
fi

VERSION_JSON="{
  \"version\": \"$VERSION\",
  \"commit\": \"$COMMIT\",
  \"date\": \"$COMMIT_DATE\"
}"

echo "$VERSION_JSON" > cli/version.json
echo "$VERSION_JSON" > agent/version.json
