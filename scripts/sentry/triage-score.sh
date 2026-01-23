#!/bin/bash
# Score and prioritize Sentry issues for triage
#
# Usage: ./scripts/sentry/triage-score.sh [--json]
#
# Scoring factors:
# - Event frequency (more = higher priority)
# - User impact (more users = higher priority)
# - Recency (newer = higher priority)
# - Error level (error > warning > info)

set -e

SENTRY_ORG="misty-step"
SENTRY_PROJECT="linejam"
OUTPUT_JSON=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      OUTPUT_JSON=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "Error: SENTRY_AUTH_TOKEN not set"
  exit 1
fi

# Fetch unresolved issues
ISSUES=$(curl -s "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=20" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN")

# Score and sort issues
SCORED=$(echo "$ISSUES" | jq '
  def score_level:
    if . == "error" then 30
    elif . == "warning" then 15
    elif . == "fatal" then 50
    else 5
    end;

  def recency_score:
    # Hours since last seen (capped at 168 = 1 week)
    ((now - (. | fromdateiso8601)) / 3600) |
    if . < 1 then 40
    elif . < 24 then 30
    elif . < 72 then 20
    elif . < 168 then 10
    else 5
    end;

  [.[] | {
    id: .shortId,
    title: .title,
    level: .level,
    count: .count,
    user_count: (.userCount // 0),
    last_seen: .lastSeen,
    score: (
      (.count | if . > 100 then 40 elif . > 10 then 25 elif . > 1 then 15 else 5 end) +
      ((.userCount // 0) | if . > 10 then 30 elif . > 3 then 20 elif . > 0 then 10 else 0 end) +
      (.level | score_level) +
      (.lastSeen | recency_score)
    )
  }] | sort_by(-.score)
')

if [ "$OUTPUT_JSON" = true ]; then
  echo "$SCORED"
else
  echo "=== Sentry Issue Triage ==="
  echo ""
  echo "$SCORED" | jq -r '.[] | "[\(.score | tostring | .[0:3])] \(.id): \(.title) (\(.count) events, \(.user_count) users)"'
  echo ""
  echo "Score = frequency + user_impact + severity + recency (higher = more urgent)"
fi
