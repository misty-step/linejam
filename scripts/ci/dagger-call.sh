#!/usr/bin/env bash

set -euo pipefail

FUNCTION_NAME="${1:?Usage: scripts/ci/dagger-call.sh <function> [extra dagger args...]}"
shift || true

CONVEX_DEV_URL=""
CONVEX_PROD_URL=""

case "$FUNCTION_NAME" in
  agentic-qa) FUNCTION_NAME="agentic-qa" ;;
  agentic-qa-preview) FUNCTION_NAME="agentic-qa-preview" ;;
  all-no-e2e) FUNCTION_NAME="all-no-e-2-e" ;;
  e2e) FUNCTION_NAME="e-2-e" ;;
esac

# Dagger currently climbs parent directories for .env files while loading the
# TypeScript SDK. Main checkouts usually already have a repo-root .env, but
# ephemeral worktrees often do not, so create temporary placeholders in both
# locations and clean them up after the run.
TEMP_ROOT_ENV=0
TEMP_DAGGER_ENV=0
TEMP_SOURCE_DIR=""
ORIGINAL_PWD="$PWD"
if [[ ! -f .env ]]; then
  : > .env
  TEMP_ROOT_ENV=1
fi

if [[ ! -f dagger/.env ]]; then
  : > dagger/.env
  TEMP_DAGGER_ENV=1
fi

create_source_snapshot() {
	local snapshot_dir
	snapshot_dir="$(mktemp -d "${TMPDIR:-/tmp}/linejam-dagger-src.XXXXXX")"

	git -c core.fsmonitor=false ls-files --cached --others --exclude-standard -z | \
		while IFS= read -r -d '' path; do
			[[ -e "$path" ]] || continue
			printf '%s\0' "$path"
		done | \
		rsync -a --from0 --files-from=- ./ "${snapshot_dir}/"

	echo "${snapshot_dir}"
}

cleanup() {
  if [[ "${TEMP_ROOT_ENV}" == "1" ]]; then
    rm -f .env
  fi

  if [[ "${TEMP_DAGGER_ENV}" == "1" ]]; then
    rm -f dagger/.env
  fi

	if [[ -n "${TEMP_SOURCE_DIR}" ]]; then
		if [[ "$PWD" == "$TEMP_SOURCE_DIR"* ]]; then
			cd "$ORIGINAL_PWD"
		fi
		rm -rf "${TEMP_SOURCE_DIR}"
	fi
}

trap cleanup EXIT

with_clean_node_ipc_env() {
	env \
		-u NODE_CHANNEL_FD \
		-u NODE_CHANNEL_SERIALIZATION_MODE \
		-u NODE_UNIQUE_ID \
		"$@"
}

run_node() {
	with_clean_node_ipc_env node "$@"
}

run_npx() {
	with_clean_node_ipc_env npx "$@"
}

load_env_file() {
	local env_file="$1"
	local stream_file
	local key
	local value
	local status=0

	stream_file="$(mktemp "${TMPDIR:-/tmp}/linejam-dotenv-stream.XXXXXX")"
	run_node ./scripts/ci/dotenv.mjs "$env_file" >"$stream_file"

	while IFS= read -r -d '' key; do
		if ! IFS= read -r -d '' value; then
			echo >&2 "Malformed dotenv stream from ${env_file}"
			status=1
			break
		fi

		export "${key}=${value}"
	done <"$stream_file"

	rm -f "$stream_file"
	return "$status"
}

normalize_url() {
	local value="${1:-}"
	value="${value%"${value##*[![:space:]]}"}"
	value="${value#"${value%%[![:space:]]*}"}"
	printf '%s' "${value%/}"
}

convex_url_for_mode() {
	local mode="${1:?mode is required}"

	if [[ "$mode" == "dev" && -n "$CONVEX_DEV_URL" ]]; then
		printf '%s' "$CONVEX_DEV_URL"
		return 0
	fi

	if [[ "$mode" == "prod" && -n "$CONVEX_PROD_URL" ]]; then
		printf '%s' "$CONVEX_PROD_URL"
		return 0
	fi

	local -a command=(run_npx convex function-spec)
	if [[ "$mode" == "prod" ]]; then
		command+=(--prod)
	fi

	local url
	url="$(
		"${command[@]}" | \
			sed -n 's/.*"url": "\([^"]*\)".*/\1/p' | \
			head -n 1
	)"
	url="$(normalize_url "$url")"

	if [[ "$mode" == "dev" ]]; then
		CONVEX_DEV_URL="$url"
	else
		CONVEX_PROD_URL="$url"
	fi

	printf '%s' "$url"
}

is_local_convex_url() {
	local url
	url="$(normalize_url "${1:-}")"
	[[ "$url" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]
}

function_requires_guest_token() {
	case "$FUNCTION_NAME" in
		all|all-no-e-2-e|build-check|e-2-e)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

function_requires_local_convex_sync() {
	case "$FUNCTION_NAME" in
		all|e-2-e)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

function_requires_clerk_convex_template() {
	case "$FUNCTION_NAME" in
		all|e-2-e)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

function_requires_clerk_convex_template_validation() {
	case "$FUNCTION_NAME" in
		smoke)
			[[ "${PLAYWRIGHT_REQUIRE_AUTH_SMOKE:-0}" == "1" ]]
			return
			;;
		*)
			return 1
			;;
	esac
}

function_requires_canary_browser_config() {
	case "$FUNCTION_NAME" in
		all|all-no-e-2-e|build-check|e-2-e)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

should_prepare_local_convex() {
	local sync_mode="${LINEJAM_SYNC_CONVEX_BEFORE_DAGGER:-auto}"

	case "$sync_mode" in
		0|false|FALSE|no|NO)
			return 1
			;;
		1|true|TRUE|yes|YES)
			return 0
			;;
	esac

	[[ -z "${CI:-}" ]]
}

derive_clerk_issuer_domain() {
	run_node - <<'NODE'
const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
  process.env.CLERK_PUBLISHABLE_KEY?.trim() ||
  '';

if (!publishableKey) {
  process.exit(1);
}

const encodedDomain = publishableKey.split('_').at(-1);
if (!encodedDomain) {
  process.exit(1);
}

try {
  const decoded = Buffer.from(encodedDomain, 'base64url')
    .toString('utf8')
    .replace(/\$+$/, '');

  if (!decoded) {
    process.exit(1);
  }

  process.stdout.write(
    decoded.startsWith('https://') ? decoded : `https://${decoded}`
  );
} catch {
  process.exit(1);
}
NODE
}

ensure_dev_clerk_issuer_domain() {
	local issuer_domain="${CLERK_JWT_ISSUER_DOMAIN:-}"
	if [[ -z "$issuer_domain" ]]; then
		issuer_domain="$(derive_clerk_issuer_domain)"
	fi

	if [[ -z "$issuer_domain" ]]; then
		echo >&2 "Unable to derive CLERK_JWT_ISSUER_DOMAIN for the active Convex dev deployment. Set CLERK_JWT_ISSUER_DOMAIN or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY before running local Dagger auth coverage."
		return 1
	fi

	local normalized_issuer_domain
	normalized_issuer_domain="$(normalize_url "$issuer_domain")"
	local current_issuer_domain=""
	if current_issuer_domain="$(run_npx convex env get CLERK_JWT_ISSUER_DOMAIN 2>/dev/null || true)"; then
		current_issuer_domain="$(normalize_url "$current_issuer_domain")"
	fi

	if [[ -n "$current_issuer_domain" && "$current_issuer_domain" == "$normalized_issuer_domain" ]]; then
		return 0
	fi

	if [[ -n "$current_issuer_domain" ]]; then
		echo "Updating CLERK_JWT_ISSUER_DOMAIN in the active Convex dev deployment..." >&2
	else
		echo "Seeding CLERK_JWT_ISSUER_DOMAIN into the active Convex dev deployment..." >&2
	fi

	run_npx convex env set CLERK_JWT_ISSUER_DOMAIN "$issuer_domain" >/dev/null
}

validate_smoke_base_url() {
	local enforce_allowlist="${LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST:-0}"
	case "$enforce_allowlist" in
		1|true|TRUE|yes|YES) ;;
		*) return 0 ;;
	esac

	run_node - <<'NODE'
const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || '';
if (!baseUrl) {
  console.error('PLAYWRIGHT_BASE_URL is required when smoke URL allowlisting is enabled.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(baseUrl);
} catch {
  console.error(`PLAYWRIGHT_BASE_URL is not a valid URL: ${baseUrl}`);
  process.exit(1);
}

const allowedOrigins = (process.env.LINEJAM_ALLOWED_SMOKE_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowedHosts = (process.env.LINEJAM_ALLOWED_SMOKE_HOSTS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const hostPattern = process.env.LINEJAM_ALLOWED_SMOKE_HOST_PATTERN?.trim();

const matchesOrigin = allowedOrigins.includes(parsed.origin);
const matchesHost = allowedHosts.includes(parsed.hostname);
const matchesPattern =
  hostPattern && new RegExp(hostPattern, 'i').test(parsed.hostname);

if (matchesOrigin || matchesHost || matchesPattern) {
  process.exit(0);
}

console.error(
  `Refusing to run smoke against untrusted origin ${parsed.origin}. ` +
    'Configure LINEJAM_ALLOWED_SMOKE_ORIGINS, LINEJAM_ALLOWED_SMOKE_HOSTS, or LINEJAM_ALLOWED_SMOKE_HOST_PATTERN.'
);
process.exit(1);
NODE
}

validate_smoke_auth_configuration() {
	if [[ "${PLAYWRIGHT_REQUIRE_AUTH_SMOKE:-0}" != "1" ]]; then
		return 0
	fi

	run_node --input-type=module - <<'NODE'
import { getSmokeClerkKeyError } from './scripts/canary/smoke-auth.mjs';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || '';
const error = getSmokeClerkKeyError(baseUrl);

if (error) {
  console.error(error);
  process.exit(1);
}
NODE
}

prepare_local_convex_backend() {
	local target_url
	target_url="$(normalize_url "${NEXT_PUBLIC_CONVEX_URL:-}")"

	if [[ -z "$target_url" ]] || is_local_convex_url "$target_url"; then
		return 0
	fi

	local dev_url
	dev_url="$(convex_url_for_mode dev)"
	local prod_url
	prod_url="$(convex_url_for_mode prod)"

	if [[ "$target_url" == "$dev_url" ]]; then
		ensure_dev_clerk_issuer_domain
		echo "Syncing the active Convex dev deployment before local Dagger E2E..." >&2
		run_npx convex dev --once --typecheck disable --codegen disable >/dev/null
		return 0
	fi

	if [[ "$target_url" == "$prod_url" ]]; then
		if [[ "${LINEJAM_ALLOW_PROD_CONVEX_SYNC:-0}" != "1" ]]; then
			echo >&2 "Refusing to sync the Convex production deployment from local Dagger. Set LINEJAM_ALLOW_PROD_CONVEX_SYNC=1 only if you intentionally want local Dagger to push production Convex code."
			return 1
		fi

		echo "Syncing the Convex production deployment before local Dagger E2E..." >&2
		run_npx convex deploy --yes --typecheck disable --codegen disable >/dev/null
		return 0
	fi

	echo >&2 "NEXT_PUBLIC_CONVEX_URL does not match the active Convex dev or production deployment. Point local Dagger at the same backend the Convex CLI resolves, or set LINEJAM_SYNC_CONVEX_BEFORE_DAGGER=0 to skip automatic sync."
	return 1
}

hydrate_guest_token_secret() {
	if [[ -n "${GUEST_TOKEN_SECRET:-}" ]]; then
		return 0
	fi

	local target_url
	target_url="$(normalize_url "${NEXT_PUBLIC_CONVEX_URL:-}")"
	if [[ -z "$target_url" ]] || is_local_convex_url "$target_url"; then
		echo >&2 "GUEST_TOKEN_SECRET is required when NEXT_PUBLIC_CONVEX_URL targets a remote deployment. Export it manually or point local Dagger at a local Convex backend."
		return 1
	fi

	local dev_url
	dev_url="$(convex_url_for_mode dev)"
	local prod_url
	prod_url="$(convex_url_for_mode prod)"

	if [[ "$target_url" == "$dev_url" ]]; then
		export GUEST_TOKEN_SECRET
		GUEST_TOKEN_SECRET="$(run_npx convex env get GUEST_TOKEN_SECRET)"
		return 0
	fi

	if [[ "$target_url" == "$prod_url" ]]; then
		export GUEST_TOKEN_SECRET
		GUEST_TOKEN_SECRET="$(run_npx convex env get GUEST_TOKEN_SECRET --prod)"
		return 0
	fi

	echo >&2 "Unable to hydrate GUEST_TOKEN_SECRET because NEXT_PUBLIC_CONVEX_URL does not match the active Convex dev or production deployment."
	return 1
}

ensure_clerk_convex_template() {
	local publishable_key="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"

	if [[ -z "${CLERK_SECRET_KEY:-}" || -z "$publishable_key" ]]; then
		return 0
	fi

	local -a command=(node ./scripts/ci/ensure-clerk-convex-template.mjs)
	if [[ "${LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE:-0}" == "1" ]]; then
		command+=(--allow-live-mutation)
	fi

	export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$publishable_key"
	with_clean_node_ipc_env "${command[@]}"
}

validate_clerk_convex_template() {
	local publishable_key="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-${CLERK_PUBLISHABLE_KEY:-}}"

	if [[ -z "${CLERK_SECRET_KEY:-}" || -z "$publishable_key" ]]; then
		return 0
	fi

	export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$publishable_key"
	run_node ./scripts/ci/ensure-clerk-convex-template.mjs --check-only
}

ensure_canary_browser_config() {
	if [[ -z "${NEXT_PUBLIC_CANARY_ENDPOINT:-}" && -n "${CANARY_ENDPOINT:-}" ]]; then
		export NEXT_PUBLIC_CANARY_ENDPOINT="${CANARY_ENDPOINT}"
	fi

	local endpoint="${NEXT_PUBLIC_CANARY_ENDPOINT:-}"
	local api_key="${NEXT_PUBLIC_CANARY_API_KEY:-}"

	if [[ -z "$endpoint" || -z "$api_key" ]]; then
		echo >&2 "NEXT_PUBLIC_CANARY_ENDPOINT and NEXT_PUBLIC_CANARY_API_KEY are required for ${FUNCTION_NAME}. Canary is the primary observability sink, so the authoritative Dagger contract must run with real browser-side Canary config."
		return 1
	fi

	if [[ "$api_key" == "example_canary_write_key" ]]; then
		echo >&2 "Refusing to run ${FUNCTION_NAME} with the placeholder NEXT_PUBLIC_CANARY_API_KEY. Export a real Canary browser write key before running the authoritative Dagger contract."
		return 1
	fi
}

env_files=(.env)
if [[ "$FUNCTION_NAME" == "smoke" ]]; then
	env_files+=(.env.local .env.production.local)
else
	env_files+=(.env.production.local .env.local)
fi

for env_file in "${env_files[@]}"; do
	if [[ -f "$env_file" ]]; then
		load_env_file "$env_file"
	fi
done

if function_requires_local_convex_sync && should_prepare_local_convex; then
	prepare_local_convex_backend
fi

if function_requires_clerk_convex_template; then
	ensure_clerk_convex_template
fi

if function_requires_clerk_convex_template_validation; then
	validate_clerk_convex_template
fi

if function_requires_guest_token; then
	hydrate_guest_token_secret
fi

if function_requires_canary_browser_config; then
	ensure_canary_browser_config
fi

if [[ "$FUNCTION_NAME" == "smoke" || "$FUNCTION_NAME" == "agentic-qa-preview" ]]; then
	validate_smoke_base_url
fi

if [[ "$FUNCTION_NAME" == "smoke" ]]; then
	validate_smoke_auth_configuration
fi

TEMP_SOURCE_DIR="$(create_source_snapshot)"
cd "$TEMP_SOURCE_DIR"

ARGS=("call" "$FUNCTION_NAME" "--source=.")

append_arg() {
	local flag="$1"
	local value="${2:-}"

	if [[ -n "$value" ]]; then
		ARGS+=("${flag}=${value}")
	fi
}

append_secret_arg() {
	local flag="$1"
	local env_name="$2"
	local value="${!env_name:-}"

	if [[ -n "$value" ]]; then
		ARGS+=("${flag}=env://${env_name}")
	fi
}

append_app_env() {
	append_arg "--next-public-convex-url" "${NEXT_PUBLIC_CONVEX_URL:-}"
	append_arg "--next-public-clerk-publishable-key" "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}"
	append_secret_arg "--clerk-secret-key" "CLERK_SECRET_KEY"
	append_arg "--clerk-jwt-issuer-domain" "${CLERK_JWT_ISSUER_DOMAIN:-}"
	append_arg "--playwright-clerk-test-email" "${PLAYWRIGHT_CLERK_TEST_EMAIL:-}"
	append_secret_arg "--guest-token-secret" "GUEST_TOKEN_SECRET"
	append_arg "--canary-endpoint" "${CANARY_ENDPOINT:-}"
	append_arg "--next-public-canary-endpoint" "${NEXT_PUBLIC_CANARY_ENDPOINT:-}"
	append_arg "--next-public-canary-api-key" "${NEXT_PUBLIC_CANARY_API_KEY:-}"
}

case "$FUNCTION_NAME" in
  agentic-qa|agentic-qa-preview|all|all-no-e-2-e|base|build-check|e-2-e|format-check|lint|smoke|typecheck|unit-test)
    append_app_env
    ;;
esac

if [[ "$FUNCTION_NAME" == "all" || "$FUNCTION_NAME" == "e-2-e" ]]; then
	append_arg "--playwright-require-auth-e2e" "${PLAYWRIGHT_REQUIRE_AUTH_E2E:-1}"
fi

if [[ "$FUNCTION_NAME" == "smoke" ]]; then
	append_arg "--base-url" "${PLAYWRIGHT_BASE_URL:-}"
	append_arg "--playwright-require-auth-smoke" "${PLAYWRIGHT_REQUIRE_AUTH_SMOKE:-}"
fi

if [[ "$FUNCTION_NAME" == "agentic-qa-preview" ]]; then
	append_arg "--base-url" "${PLAYWRIGHT_BASE_URL:-}"
	append_arg "--mission" "${LINEJAM_AGENTIC_MISSION:-}"
fi

dagger_success_marker() {
	case "$FUNCTION_NAME" in
		agentic-qa) printf '%s' 'Ci.agenticQa DONE' ;;
		agentic-qa-preview) printf '%s' 'Ci.agenticQaPreview DONE' ;;
		all) printf '%s' 'Ci.all DONE' ;;
		all-no-e-2-e) printf '%s' 'Ci.allNoE2e DONE' ;;
		build-check) printf '%s' 'Ci.buildCheck DONE' ;;
		e-2-e) printf '%s' 'Ci.e2e DONE' ;;
		format-check) printf '%s' 'Ci.formatCheck DONE' ;;
		lint) printf '%s' 'Ci.lint DONE' ;;
		smoke) printf '%s' 'Ci.smoke DONE' ;;
		typecheck) printf '%s' 'Ci.typecheck DONE' ;;
		unit-test) printf '%s' 'Ci.unitTest DONE' ;;
		*) return 1 ;;
	esac
}

dagger_completed_before_transport_error() {
	local log_file="$1"
	local marker

	if ! marker="$(dagger_success_marker)"; then
		return 1
	fi

	grep -Fq "$marker" "$log_file" || return 1
	grep -Fq 'Error: Post "http://dagger/query": unexpected EOF' "$log_file" || return 1
	grep -Fq 'cleanup failed msg="close dagger session"' "$log_file" || return 1
}

run_dagger() {
	local log_file
	local status

	log_file="$(mktemp "${TMPDIR:-/tmp}/linejam-dagger-call.XXXXXX")"

	set +e
	dagger "${ARGS[@]}" "$@" 2>&1 | tee "$log_file"
	status="${PIPESTATUS[0]}"
	set -e

	if [[ "$status" -ne 0 ]] && dagger_completed_before_transport_error "$log_file"; then
		echo >&2 "Dagger transport cleanup failed after ${FUNCTION_NAME} completed successfully; treating the run as passed."
		rm -f "$log_file"
		return 0
	fi

	if [[ "$status" -eq 0 ]]; then
		rm -f "$log_file"
	fi

	return "$status"
}

run_dagger "$@"
