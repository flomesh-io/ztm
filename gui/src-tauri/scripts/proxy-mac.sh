#!/bin/bash

ACTION=$1
PROXY=$2

set_proxy() {
    [[ -z "$PROXY" ]] && exit 1

    ACTIVE_SERVICE=$(networksetup -listallnetworkservices | grep -E 'Wi-Fi|Ethernet' | while read service; do
        # Check if the service is active by checking the connection status
        STATUS=$(networksetup -getinfo "$service" | grep "IP address" | awk '{print $3}')
        if [[ -n "$STATUS" ]]; then
            echo "$service"
            break
        fi
    done)

    if [[ -z "$ACTIVE_SERVICE" ]]; then
        echo "No active network found."
        exit 1
    fi

    networksetup -setwebproxy "$ACTIVE_SERVICE" "$(echo "$PROXY" | cut -d':' -f1)" "$(echo "$PROXY" | cut -d':' -f2)" || exit 1
    networksetup -setsecurewebproxy "$ACTIVE_SERVICE" "$(echo "$PROXY" | cut -d':' -f1)" "$(echo "$PROXY" | cut -d':' -f2)" || exit 1

    exit 0
}

unset_proxy() {
    ACTIVE_SERVICE=$(networksetup -listallnetworkservices | grep -E 'Wi-Fi|Ethernet' | while read service; do
        # Check if the service is active by checking the connection status
        STATUS=$(networksetup -getinfo "$service" | grep "IP address" | awk '{print $3}')
        if [[ -n "$STATUS" ]]; then
            echo "$service"
            break
        fi
    done)

    if [[ -z "$ACTIVE_SERVICE" ]]; then
        echo "No active network found."
        exit 1
    fi

    networksetup -setwebproxystate "$ACTIVE_SERVICE" off || exit 1
    networksetup -setsecurewebproxystate "$ACTIVE_SERVICE" off || exit 1

    exit 0
}

case "$ACTION" in
    register) set_proxy ;;
    unregister) unset_proxy ;;
    *) exit 1 ;;
esac

