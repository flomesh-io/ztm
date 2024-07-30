#!/bin/sh

ZTM_NAMES=${ZTM_NAMES:-0.0.0.0}
ZTM_PORT=${ZTM_PORT:-8888}

exec /usr/local/bin/ztm run hub --listen 0.0.0.0:${ZTM_PORT} --names "${ZTM_NAMES}:${ZTM_PORT}" --permit /permit/root.json