#!/usr/bin/env bash
# Operator adapter, called over SSH by an engineer-profile no-agent Hermes cron.
set -euo pipefail
root=${1:?Supply the owned Mirrodin workspace root}
mode=${2:-fast}
case "$mode" in
  fast) schedule='*/30 * * * *'; promotion=(--promote) ;;
  full) schedule='15 6,18 * * *'; promotion=() ;;
  *) printf 'Expected fast or full\n' >&2; exit 2 ;;
esac
export SENTRY_DSN
SENTRY_DSN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["NEXT_PUBLIC_SENTRY_DSN"])' "$root/production-public.json")
export SENTRY_LOAD_DOTENV=0 SENTRY_HTTP_MAX_RETRIES=0 SENTRY_DISABLE_UPDATE_CHECK=true
exec "$root/tools/sentry-cli" monitors run "linejam-native-$mode" \
  --environment production --schedule "$schedule" --timezone UTC \
  --check-in-margin 10 --max-runtime 60 \
  --failure-issue-threshold 1 --recovery-threshold 1 -- \
  python3 "$root/native-repo/scripts/train.py" \
    --repo "$root/native-repo" --home "$root/train" --mode "$mode" \
    --node /home/phaedrus/.local/share/mise/installs/node/22.23.2 \
    --pnpm /home/phaedrus/.local/share/mise/installs/pnpm/10.22.0 \
    --rustup /home/phaedrus/.rustup --cargo-bin /home/phaedrus/.cargo/bin \
    --public-config "$root/production-public.json" \
    --network linejam-t79984c80-native --dns 1.1.1.1 \
    --image sha256:b1866c2a3e704f2609d43780038d7eab7acaadd0648283675481ecc11942c385 \
    --wrangler "$root/tools/deployer/node_modules/wrangler/bin/wrangler.js" \
    "${promotion[@]}"
