#!/usr/bin/env bash
# Writes Config/Local.xcconfig so a device build reaches the backend on this
# Mac over the LAN. The idea is the reference's scripts/ios-build.mjs: a
# handset cannot reach "localhost", so find this Mac's IPv4 address.
#
#   scripts/lan-xcconfig.sh              detect the address, port 8787
#   scripts/lan-xcconfig.sh 8788         detect the address, another port
#   scripts/lan-xcconfig.sh 8787 1.2.3.4 use this address
set -euo pipefail
cd "$(dirname "$0")/.."

port="${1:-8787}"
ip="${2:-}"
if [ -z "$ip" ]; then
  for iface in $(ifconfig -l); do
    candidate="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    case "$candidate" in
      "" | 127.* | 169.254.*) ;;
      *) ip="$candidate"; break ;;
    esac
  done
fi
if [ -z "$ip" ]; then
  echo "Could not find a LAN address. Pass one: scripts/lan-xcconfig.sh $port 192.168.1.23" >&2
  exit 1
fi

cat > Config/Local.xcconfig <<CONF
// Written by scripts/lan-xcconfig.sh. Not committed.
API_BASE = http:/\$()/$ip:$port
CONF
echo "API_BASE = http://$ip:$port (Config/Local.xcconfig)"
