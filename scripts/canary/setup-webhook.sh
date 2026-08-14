#!/usr/bin/env bash

set -euo pipefail

: "${CANARY_API_KEY:?CANARY_API_KEY is required}"
: "${LINEJAM_CANARY_WEBHOOK_URL:?LINEJAM_CANARY_WEBHOOK_URL is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec node "$SCRIPT_DIR/setup-webhook.mjs" "$@"
