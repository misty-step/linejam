#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: restore-convex-backup.sh <backup.zip.age> [target] --identity <identity-file> [--allow-production]

Targets:
  local                      Use the local anonymous Convex deployment (default).
  dev                        Use the current project dev deployment.
  preview:<name>             Use a named non-production preview deployment.
  production                 Use production only with --allow-production.
  key                        Use CONVEX_DEPLOY_KEY or CONVEX_DEPLOYMENT_TOKEN from the environment.
USAGE
}

backup_path=""
target=""
target_explicit=0
identity_file=""
allow_production=0

while (($# > 0)); do
  case "$1" in
    --identity|-i|--identity-file)
      if (($# < 2)); then
        echo "--identity requires a file path." >&2
        usage
        exit 2
      fi
      identity_file="$2"
      shift 2
      ;;
    --allow-production)
      allow_production=1
      shift
      ;;
    --target)
      if (($# < 2)); then
        echo "--target requires a target name." >&2
        usage
        exit 2
      fi
      target="$2"
      target_explicit=1
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      if [[ -z "$backup_path" ]]; then
        backup_path="$1"
      elif ((target_explicit == 0)); then
        target="$1"
        target_explicit=1
      else
        echo "Only one target may be supplied." >&2
        usage
        exit 2
      fi
      shift
      ;;
  esac
done

if [[ -z "$backup_path" ]]; then
  echo "An encrypted .age backup path is required." >&2
  usage
  exit 2
fi
if [[ "$backup_path" != *.age ]]; then
  echo "Refusing a non-age backup; expected a .zip.age file." >&2
  exit 1
fi
if [[ ! -f "$backup_path" ]]; then
  echo "Backup file does not exist: $backup_path" >&2
  exit 1
fi
if [[ -z "$identity_file" ]]; then
  echo "An age identity file is required; pass --identity <path>." >&2
  exit 2
fi
if [[ ! -f "$identity_file" ]]; then
  echo "Age identity file does not exist: $identity_file" >&2
  exit 1
fi

deploy_key="${CONVEX_DEPLOY_KEY:-}"
deploy_token="${CONVEX_DEPLOYMENT_TOKEN:-}"
if [[ -z "$deploy_key" && -n "$deploy_token" ]]; then
  deploy_key="$deploy_token"
fi

is_production_target() {
  local value="${1,,}"
  [[ "$value" == prod:* || "$value" == production:* ]] && return 0
  [[ "$value" =~ (^|[-_.:/])prod(uction)?($|[-_.:/]) ]]
}

is_production_key() {
  local value="${1:-}"
  [[ -n "$value" ]] || return 1
  local prefix="${value%%:*}"
  prefix="${prefix,,}"
  case "$prefix" in
    dev|preview|project) return 1 ;;
    prod) return 0 ;;
    *) [[ "$value" != *:* ]] ;;
  esac
}

is_production_dotenv() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  while IFS= read -r line; do
    local value="${line#*=}"
    case "${value,,}" in
      *dev:*|*preview:*|*project:*|*local*) ;;
      *) return 0 ;;
    esac
  done < <(grep -E "^[[:space:]]*(CONVEX_DEPLOY_KEY|CONVEX_DEPLOYMENT_TOKEN|CONVEX_DEPLOYMENT)[[:space:]]*=" "$file" || true)
  return 1
}

uses_key=0
resolved_target="local"
declare -a target_args=()

if ((target_explicit == 0)); then
  if [[ -n "$deploy_key" ]]; then
    uses_key=1
    resolved_target="deploy-key"
  else
    target_args+=(--deployment local)
  fi
else
  case "${target,,}" in
    local)
      target_args+=(--deployment local)
      resolved_target="local"
      ;;
    dev)
      target_args+=(--deployment dev)
      resolved_target="dev"
      ;;
    key)
      if [[ -z "$deploy_key" ]]; then
        echo "Target key requires CONVEX_DEPLOY_KEY or CONVEX_DEPLOYMENT_TOKEN." >&2
        exit 1
      fi
      uses_key=1
      resolved_target="deploy-key"
      ;;
    preview:*)
      preview_name="${target#*:}"
      if [[ -z "$preview_name" ]]; then
        echo "Preview target requires a name." >&2
        exit 2
      fi
      target_args+=(--preview-name "$preview_name")
      resolved_target="preview:$preview_name"
      ;;
    prod|production)
      target_args+=(--prod)
      if [[ -n "$deploy_key" ]]; then
        uses_key=1
      fi
      resolved_target="production"
      ;;
    *)
      echo "Unsupported target; use local, dev, preview:<name>, key, or production." >&2
      exit 2
      ;;
  esac
fi

ambient_production=0
if is_production_key "${CONVEX_DEPLOY_KEY:-}" || is_production_key "${CONVEX_DEPLOYMENT_TOKEN:-}" || is_production_target "${CONVEX_DEPLOYMENT:-}" || is_production_target "${CONVEX_DEPLOYMENT_URL:-}"; then
  ambient_production=1
fi
for env_file in .env.local .env; do
  if is_production_dotenv "$env_file"; then
    ambient_production=1
  fi
done

if is_production_target "$resolved_target" || ((ambient_production == 1)); then
  if ((allow_production == 0)); then
    echo "Refusing to import into a production Convex deployment. Pass --allow-production only for an explicitly authorized restore." >&2
    exit 1
  fi
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/linejam-convex-restore.XXXXXX")"
decrypted_path="$tmp_dir/linejam-convex-export.zip"
controlled_env="$tmp_dir/restore.env"
cleanup() {
  if [[ -f "$decrypted_path" ]]; then
    shred --force --remove "$decrypted_path" 2>/dev/null || rm -f "$decrypted_path"
  fi
  rm -f "$controlled_env"
  rmdir "$tmp_dir" 2>/dev/null || rm -rf "$tmp_dir"
}
trap cleanup EXIT HUP INT TERM

age -d -i "$identity_file" -o "$decrypted_path" "$backup_path"

command=(pnpm exec convex import --replace-all --yes)
command+=("${target_args[@]}")
if ((uses_key == 1)); then
  command+=("$decrypted_path")
  env -u CONVEX_DEPLOYMENT_TOKEN -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOYMENT_URL CONVEX_DEPLOY_KEY="$deploy_key" "${command[@]}"
elif [[ "$resolved_target" == "production" ]]; then
  command+=("$decrypted_path")
  env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT_TOKEN -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOYMENT_URL -u CONVEX_SELF_HOSTED_URL -u CONVEX_SELF_HOSTED_ADMIN_KEY "${command[@]}"
else
  printf "CONVEX_AGENT_MODE=anonymous\n" > "$controlled_env"
  command+=(--env-file "$controlled_env" "$decrypted_path")
  env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT_TOKEN -u CONVEX_DEPLOYMENT -u CONVEX_DEPLOYMENT_URL -u CONVEX_SELF_HOSTED_URL -u CONVEX_SELF_HOSTED_ADMIN_KEY CONVEX_AGENT_MODE=anonymous "${command[@]}"
fi
