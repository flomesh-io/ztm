#!/bin/bash

# Check if required environment variables are set
if [ -z "$ZTM_JOIN_MESH" ]; then
  echo "Error: ZTM_JOIN_MESH environment variable is not set."
  exit 1
fi

if [ -z "$ZTM_ENDPOINT" ]; then
  echo "Error: ZTM_ENDPOINT environment variable is not set."
  exit 1
fi

# Set default values for optional environment variables
ZTM_PORT=${ZTM_PORT:-7777}
ZTM_PERMIT=${ZTM_PERMIT:-/permit}

# Run the command
exec /usr/local/bin/ztm run agent --listen 0.0.0.0:$ZTM_PORT --permit ${ZTM_PERMIT}/ztm-permit.json --join $ZTM_JOIN_MESH --join-as $ZTM_ENDPOINT
