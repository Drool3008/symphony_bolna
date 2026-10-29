#!/usr/bin/env bash
# Runs a command with a backend of its own: the scripted provider, a fresh
# temporary database, on the given port. Stops the backend afterwards.
#
#   scripts/with-backend.sh 8799 -- xcodebuild test ...
set -euo pipefail
port="$1"; shift
[ "${1:-}" = "--" ] && shift
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
dir="$(mktemp -d -t vantari-ios-backend)"

(cd "$repo" && MODEL_PROVIDER=stub STUB_THINK_MS=0 PORT="$port" DATABASE_PATH="$dir/session.sqlite" \
  exec npm run --silent start -w @family-health/server) > "$dir/server.log" 2>&1 &
pid=$!
cleanup() { pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; rm -rf "$dir"; }
trap cleanup EXIT

for _ in $(seq 1 120); do
  if nc -z localhost "$port" 2>/dev/null; then break; fi
  sleep 0.25
done
nc -z localhost "$port" || { echo "the backend did not start on $port" >&2; cat "$dir/server.log" >&2; exit 1; }
"$@"
