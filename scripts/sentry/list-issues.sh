#!/bin/bash
# List recent Sentry issues for linejam
#
# Usage: ./scripts/sentry/list-issues.sh [--limit N] [--env ENV]
#
# Requires SENTRY_AUTH_TOKEN in environment

set -e

SENTRY_ORG="misty-step"
SENTRY_PROJECT="linejam"
LIMIT=10
ENV=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --env)
      ENV="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "Error: SENTRY_AUTH_TOKEN not set"
  echo "Get one from: https://sentry.io/settings/account/api/auth-tokens/"
  exit 1
fi

# Build query
QUERY="is:unresolved"
if [ -n "$ENV" ]; then
  QUERY="${QUERY}+environment:${ENV}"
fi

# Fetch issues
curl -s "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=${QUERY}&limit=${LIMIT}" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" | \
  jq -r '.[] | "[\(.shortId)] \(.title) (\(.count) events, last: \(.lastSeen | split("T")[0]))"'
