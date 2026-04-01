#!/usr/bin/env bash

set -euo pipefail

CLAIMS_DIR="${CLAIMS_DIR:-.claims}"

claim_path() {
  printf '%s/%s.lock' "$CLAIMS_DIR" "$1"
}

claim_acquire() {
  local item_id="$1"
  local path
  path="$(claim_path "$item_id")"

  /bin/mkdir -p "$CLAIMS_DIR"

  if /bin/mkdir "$path" 2>/dev/null; then
    {
      printf 'item=%s\n' "$item_id"
      printf 'pid=%s\n' "$$"
      printf 'created_at=%s\n' "$(/bin/date -u +"%Y-%m-%dT%H:%M:%SZ")"
      printf 'host=%s\n' "${HOSTNAME:-unknown}"
    } >"$path/metadata"
    return 0
  fi

  printf 'claim already held for %s\n' "$item_id" >&2
  return 1
}

claim_release() {
  local item_id="$1"
  /bin/rm -rf "$(claim_path "$item_id")"
}

claim_list() {
  if [ ! -d "$CLAIMS_DIR" ]; then
    return 0
  fi

  /usr/bin/find "$CLAIMS_DIR" -mindepth 1 -maxdepth 1 -type d -name '*.lock' -print \
    | /usr/bin/sed "s#^$CLAIMS_DIR/##" \
    | /usr/bin/sed 's/\.lock$//' \
    | /usr/bin/sort
}
