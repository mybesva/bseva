#!/usr/bin/env bash
# Deprecated wrapper — use scripts/sync-firebase-clients.sh (Customer + Admin, same Firebase project).
exec "$(cd "$(dirname "$0")" && pwd)/sync-firebase-clients.sh" "$@"
