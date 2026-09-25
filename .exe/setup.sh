#!/usr/bin/env bash
set -euo pipefail

# The isolated stack builds its own pinned pnpm/Playwright image. The workspace
# needs only the orchestration tools; it must not import provider credentials.
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'Linejam workspace requires Linux/amd64 containers.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node 22 or newer is required.' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  echo 'Node 22 or newer is required.' >&2; exit 1;
}
command -v docker >/dev/null || { echo 'A local Docker CLI and daemon are required.' >&2; exit 1; }
docker buildx version >/dev/null || {
  echo 'Docker Buildx is required for the isolated application image.' >&2; exit 1;
}
supported_compose() {
  [[ $(docker compose version --short 2>/dev/null) =~ ^v?5\.5\.1$ ]]
}
if ! supported_compose; then
  # Official v5.5.1 GitHub release asset digest. Install as a user plugin,
  # leaving the host's system Compose and other users' Docker untouched.
  plugin="$HOME/.docker/cli-plugins/docker-compose"
  [[ ! -e $plugin && ! -L $plugin ]] || {
    echo "Existing unsupported Compose plugin at $plugin; refusing to replace it." >&2
    exit 1
  }
  scratch_root="${XDG_CACHE_HOME:-$HOME/.cache}/tmp"
  mkdir -p "$scratch_root"
  tmp=$(mktemp -d "$scratch_root/linejam-setup.XXXXXXXX")
  trap 'rm -rf -- "$tmp"' EXIT
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --retry 3 \
    --output "$tmp/docker-compose" \
    https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-linux-x86_64
  printf '%s  %s\n' db1889184726840f75c4f9c001048430d4f25b3be3cb084d3ddd762bc0aed576 \
    "$tmp/docker-compose" | sha256sum --check --strict
  mkdir -p "$(dirname "$plugin")"
  install -m 755 "$tmp/docker-compose" "$plugin"
  supported_compose || { echo 'Installed Compose 5.5.1 did not activate.' >&2; exit 1; }
fi
compose_version=$(docker compose version --short)
docker info --format '{{.ServerVersion}}' >/dev/null || {
  echo 'A reachable local Docker daemon is required; no daemon is started by setup.' >&2
  exit 1
}
echo "Linejam isolated runtime prerequisites ready (Node $(node --version), Docker Compose $compose_version)."
