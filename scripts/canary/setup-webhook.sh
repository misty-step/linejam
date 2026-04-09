#!/usr/bin/env bash

set -euo pipefail

: "${CANARY_API_KEY:?CANARY_API_KEY is required}"
: "${LINEJAM_CANARY_WEBHOOK_URL:?LINEJAM_CANARY_WEBHOOK_URL is required}"

exec node ./scripts/canary/setup-webhook.mjs
