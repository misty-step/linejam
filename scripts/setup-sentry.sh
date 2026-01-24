#!/bin/bash
# Sentry Setup Script for Linejam
#
# This script helps configure Sentry for error tracking.
# Run after project creation in Sentry dashboard.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Sentry Setup for Linejam ==="
echo ""

# Sentry project details (created 2026-01-23)
SENTRY_ORG="misty-step"
SENTRY_PROJECT="linejam"
SENTRY_DSN="https://4d313b04153df1164ffa00960f504d20@o4510313803677696.ingest.us.sentry.io/4510762050650112"

echo -e "${GREEN}Sentry project: ${SENTRY_ORG}/${SENTRY_PROJECT}${NC}"
echo ""

# Check if SENTRY_AUTH_TOKEN is set
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo -e "${YELLOW}Warning: SENTRY_AUTH_TOKEN not set in environment${NC}"
  echo "Get one from: https://sentry.io/settings/account/api/auth-tokens/"
  echo ""
fi

echo "=== Required Environment Variables ==="
echo ""
echo "Add these to your .env.local file:"
echo ""
echo -e "${GREEN}# Sentry Error Tracking${NC}"
echo "NEXT_PUBLIC_SENTRY_DSN=${SENTRY_DSN}"
echo "SENTRY_ORG=${SENTRY_ORG}"
echo "SENTRY_PROJECT=${SENTRY_PROJECT}"
echo "SENTRY_AUTH_TOKEN=<your-auth-token>"
echo ""

echo "=== Vercel Setup ==="
echo ""
echo "Run these commands to set Vercel env vars:"
echo ""
echo -e "${YELLOW}vercel env add NEXT_PUBLIC_SENTRY_DSN${NC}"
echo "  Value: ${SENTRY_DSN}"
echo ""
echo -e "${YELLOW}vercel env add SENTRY_ORG${NC}"
echo "  Value: ${SENTRY_ORG}"
echo ""
echo -e "${YELLOW}vercel env add SENTRY_PROJECT${NC}"
echo "  Value: ${SENTRY_PROJECT}"
echo ""
echo -e "${YELLOW}vercel env add SENTRY_AUTH_TOKEN${NC}"
echo "  Value: (your auth token from Sentry)"
echo ""

echo "=== Alert Rules Configured ==="
echo ""
echo "1. Alert on new issues - notifies on first occurrence"
echo "2. High frequency error spike - notifies when >10 events/hour"
echo ""

echo "=== Verification ==="
echo ""
echo "After setting env vars, test with:"
echo "  1. Start dev server: pnpm dev"
echo "  2. Visit: http://localhost:3000/test-error"
echo "  3. Check Sentry dashboard for the test error"
echo ""
echo -e "${GREEN}Setup complete!${NC}"
