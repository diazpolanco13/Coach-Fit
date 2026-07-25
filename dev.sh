#!/usr/bin/env bash
# Atajo en la raíz → scripts/start.sh (reinicio limpio del dev local).
exec "$(cd "$(dirname "$0")" && pwd)/scripts/start.sh" "$@"
