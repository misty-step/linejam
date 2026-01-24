#!/bin/bash
# Resolve a Sentry issue after fixing
#
# Usage: ./scripts/sentry/resolve-issue.sh LINEJAM-123 [--ignore]
#
# Options:
#   --ignore  Mark as ignored instead of resolved

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 ISSUE_ID [--ignore]"
  exit 1
fi

ISSUE_ID="$1"
STATUS="resolved"

if [ "$2" = "--ignore" ]; then
  STATUS="ignored"
fi

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "Error: SENTRY_AUTH_TOKEN not set"
  exit 1
fi

# Update issue status
RESULT=$(curl -s -X PUT "https://sentry.io/api/0/issues/${ISSUE_ID}/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"${STATUS}\"}")

echo "$RESULT" | jq -r '"Issue \(.shortId) marked as \(.status)"'
