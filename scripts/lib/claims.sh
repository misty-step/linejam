#!/usr/bin/env bash

CLAIMS_DIR="${CLAIMS_DIR:-.claims}"

validate_claim_id() {
  local item_id="${1-}"

  case "$item_id" in
    ''|*/*|*'..'*|*[!A-Za-z0-9._-]*)
      printf 'invalid claim id: %s\n' "$item_id" >&2
      return 1
      ;;
  esac
}

claim_path() {
  local item_id="${1-}"
  validate_claim_id "$item_id" || return 1
  printf '%s/%s.lock' "$CLAIMS_DIR" "$item_id"
}

claim_acquire() {
  local item_id="${1-}"
  local created_at
  local path
  path="$(claim_path "$item_id")" || return 1

  mkdir -p "$CLAIMS_DIR" || return 1

  if mkdir "$path" 2>/dev/null; then
    created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    if {
      printf 'item=%s\n' "$item_id"
      printf 'pid=%s\n' "$$"
      printf 'created_at=%s\n' "$created_at"
      printf 'host=%s\n' "${HOSTNAME:-unknown}"
    } >"$path/metadata"; then
      return 0
    fi

    rm -rf -- "$path"
    printf 'failed to write claim metadata for %s\n' "$item_id" >&2
    return 1
  fi

  printf 'claim already held for %s\n' "$item_id" >&2
  return 1
}

claim_release() {
  local path
  path="$(claim_path "${1-}")" || return 1
  rm -rf -- "$path"
}

claim_list() {
  if [ ! -d "$CLAIMS_DIR" ]; then
    return 0
  fi

  find "$CLAIMS_DIR" -mindepth 1 -maxdepth 1 -type d -name '*.lock' -print \
    | sed "s#^$CLAIMS_DIR/##" \
    | sed 's/\.lock$//' \
    | sort
}
