#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
ENV_LOCAL="$ROOT_DIR/.env.local"
WRITE_ENV=1
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Usage: bash scripts/setup.sh [options]

Bootstrap a local Linejam workspace without clobbering existing secrets.

Options:
  --write-env             Create .env.local from .env.example when missing (default).
  --no-write-env          Do not create .env.local.
  --skip-install          Skip pnpm install.
  --env-example <path>    Read env placeholders from a custom example file.
  --env-local <path>      Write env placeholders to a custom local file.
  -h, --help              Show this help.
EOF
}

require_value() {
  local flag="${1-}"
  local value="${2-}"
  if [[ -z "$value" ]]; then
    printf '%s requires a value\n' "$flag" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write-env)
      WRITE_ENV=1
      shift
      ;;
    --no-write-env)
      WRITE_ENV=0
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --env-example)
      require_value "$1" "${2-}"
      ENV_EXAMPLE="$2"
      shift 2
      ;;
    --env-local)
      require_value "$1" "${2-}"
      ENV_LOCAL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$WRITE_ENV" -eq 1 ]]; then
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    printf 'missing env example: %s\n' "$ENV_EXAMPLE" >&2
    exit 1
  fi

  if [[ -e "$ENV_LOCAL" ]]; then
    printf 'kept existing %s\n' "$ENV_LOCAL"
  else
    mkdir -p "$(dirname "$ENV_LOCAL")"
    cp "$ENV_EXAMPLE" "$ENV_LOCAL"
    printf 'created %s from %s\n' "$ENV_LOCAL" "$ENV_EXAMPLE"
    printf 'edit %s with Convex, Clerk, guest-token, and Canary values before running the full local gate\n' "$ENV_LOCAL"
  fi
fi

if [[ "$SKIP_INSTALL" -eq 1 ]]; then
  printf 'skipped dependency install\n'
else
  if ! command -v pnpm >/dev/null 2>&1; then
    printf 'pnpm is required; install it, then rerun this script or pass --skip-install\n' >&2
    exit 1
  fi
  (cd "$ROOT_DIR" && pnpm install)
fi

printf 'setup complete\n'
