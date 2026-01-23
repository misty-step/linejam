#!/bin/bash
# Get detailed info about a Sentry issue for AI analysis
#
# Usage: ./scripts/sentry/issue-detail.sh LINEJAM-123
#
# Outputs JSON optimized for AI consumption:
# - Error message and type
# - Stack trace (truncated)
# - Context (user, tags, breadcrumbs)
# - Event count and timing

set -e

SENTRY_ORG="misty-step"
SENTRY_PROJECT="linejam"

if [ -z "$1" ]; then
  echo "Usage: $0 ISSUE_ID (e.g., LINEJAM-123)"
  exit 1
fi

ISSUE_ID="$1"

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "Error: SENTRY_AUTH_TOKEN not set"
  exit 1
fi

# Get issue details
ISSUE=$(curl -s "https://sentry.io/api/0/issues/${ISSUE_ID}/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN")

# Get latest event for stack trace
LATEST_EVENT=$(curl -s "https://sentry.io/api/0/issues/${ISSUE_ID}/events/latest/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN")

# Output structured data for AI
jq -n \
  --argjson issue "$ISSUE" \
  --argjson event "$LATEST_EVENT" \
  '{
    issue_id: $issue.shortId,
    title: $issue.title,
    culprit: $issue.culprit,
    level: $issue.level,
    status: $issue.status,
    first_seen: $issue.firstSeen,
    last_seen: $issue.lastSeen,
    count: $issue.count,
    user_count: $issue.userCount,
    tags: ($issue.tags // [] | map({key: .key, value: .value})),
    exception: ($event.entries // [] | map(select(.type == "exception")) | .[0].data.values // [] | map({
      type: .type,
      value: .value,
      stacktrace: (.stacktrace.frames // [] | reverse | .[0:5] | map({
        filename: .filename,
        function: .function,
        lineno: .lineno,
        context: .context
      }))
    })),
    breadcrumbs: ($event.entries // [] | map(select(.type == "breadcrumbs")) | .[0].data.values // [] | .[-5:] | map({
      category: .category,
      message: .message,
      timestamp: .timestamp
    })),
    url: $issue.permalink
  }'
