#!/bin/bash

ACTION=$1
PROXY=$2

detect_desktop_env() {
    if [ -n "$XDG_CURRENT_DESKTOP" ]; then
        echo "$XDG_CURRENT_DESKTOP"
    elif [ -n "$DESKTOP_SESSION" ]; then
        echo "$DESKTOP_SESSION"
    elif pgrep -x "kwin_x11" >/dev/null; then
        echo "KDE"
    elif pgrep -x "mutter" >/dev/null; then
        echo "GNOME"
    elif pgrep -x "xfwm4" >/dev/null; then
        echo "XFCE"
    elif pgrep -x "openbox" >/dev/null; then
        echo "LXDE"
    else
        echo "UNKNOWN"
    fi
}

set_proxy() {
    [[ -z "$PROXY" ]] && exit 1

    sudo sh -c "echo 'http_proxy=$PROXY' >> /etc/environment && echo 'https_proxy=$PROXY' >> /etc/environment" || exit 1
    export http_proxy="$PROXY"
    export https_proxy="$PROXY"

    DESKTOP_ENV=$(detect_desktop_env)

    case "$DESKTOP_ENV" in
        *GNOME*|*Ubuntu*)
            gsettings set org.gnome.system.proxy mode 'manual' &&
            gsettings set org.gnome.system.proxy.http host "$(echo "$PROXY" | cut -d':' -f1)" &&
            gsettings set org.gnome.system.proxy.http port "$(echo "$PROXY" | cut -d':' -f2)" &&
            gsettings set org.gnome.system.proxy.https host "$(echo "$PROXY" | cut -d':' -f1)" &&
            gsettings set org.gnome.system.proxy.https port "$(echo "$PROXY" | cut -d':' -f2)" || exit 1
            ;;
        *KDE*)
            kwriteconfig5 --file kioslaverc --group 'Proxy Settings' --key 'ProxyType' 1 &&
            kwriteconfig5 --file kioslaverc --group 'Proxy Settings' --key 'httpProxy' "$PROXY" &&
            kwriteconfig5 --file kioslaverc --group 'Proxy Settings' --key 'httpsProxy' "$PROXY" || exit 1
            ;;
        *XFCE*)
            xfconf-query -c xfce4-session -p /environment/http_proxy -s "$PROXY" &&
            xfconf-query -c xfce4-session -p /environment/https_proxy -s "$PROXY" || exit 1
            ;;
        *LXDE*)
            export ALL_PROXY="$PROXY"
            ;;
        *MATE*)
            gsettings set org.mate.system.proxy mode 'manual' &&
            gsettings set org.mate.system.proxy.http host "$(echo "$PROXY" | cut -d':' -f1)" &&
            gsettings set org.mate.system.proxy.http port "$(echo "$PROXY" | cut -d':' -f2)" &&
            gsettings set org.mate.system.proxy.https host "$(echo "$PROXY" | cut -d':' -f1)" &&
            gsettings set org.mate.system.proxy.https port "$(echo "$PROXY" | cut -d':' -f2)" || exit 1
            ;;
        *UNKNOWN*) exit 1 ;;
    esac
    exit 0
}

unset_proxy() {
    sudo sed -i '/http_proxy/d' /etc/environment &&
    sudo sed -i '/https_proxy/d' /etc/environment || exit 1
    unset http_proxy
    unset https_proxy

    DESKTOP_ENV=$(detect_desktop_env)

    case "$DESKTOP_ENV" in
        *GNOME*|*Ubuntu*)
            gsettings set org.gnome.system.proxy mode 'none' || exit 1
            ;;
        *KDE*)
            kwriteconfig5 --file kioslaverc --group 'Proxy Settings' --key 'ProxyType' 0 || exit 1
            ;;
        *XFCE*)
            xfconf-query -c xfce4-session -r -p /environment/http_proxy &&
            xfconf-query -c xfce4-session -r -p /environment/https_proxy || exit 1
            ;;
        *LXDE*)
            unset ALL_PROXY
            ;;
        *MATE*)
            gsettings set org.mate.system.proxy mode 'none' || exit 1
            ;;
        *UNKNOWN*) exit 1 ;;
    esac
    exit 0
}

case "$ACTION" in
    register) set_proxy ;;
    unregister) unset_proxy ;;
    *) exit 1 ;;
esac

