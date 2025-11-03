#!/bin/bash
# Quick test script for context summarizer endpoints using curl
#
# Usage:
#   ./test_context_summarizer.sh <thread_id> <jwt_token>
#
# Or set environment variables:
#   export THREAD_ID=your-thread-id
#   export JWT_TOKEN=your-jwt-token
#   ./test_context_summarizer.sh

set -e

BASE_URL="${BACKEND_URL:-http://localhost:8000}"
THREAD_ID="${1:-$THREAD_ID}"
JWT_TOKEN="${2:-$JWT_TOKEN}"

if [ -z "$THREAD_ID" ] || [ -z "$JWT_TOKEN" ]; then
    echo "Usage: $0 <thread_id> <jwt_token>"
    echo "Or set: THREAD_ID and JWT_TOKEN environment variables"
    exit 1
fi

echo "Testing Context Summarizer Endpoints"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "Thread ID: $THREAD_ID"
echo ""

# Test 1: Test endpoint
echo "Test 1: GET /threads/$THREAD_ID/summarize/test"
echo "------------------------------------------------"
curl -s -X GET \
    "$BASE_URL/threads/$THREAD_ID/summarize/test" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nHTTP Status: %{http_code}\n" \
    | jq . 2>/dev/null || cat
echo ""

# Test 2: Stream endpoint
echo "Test 2: POST /threads/$THREAD_ID/summarize/stream"
echo "------------------------------------------------"
echo "Streaming response (press Ctrl+C to stop):"
echo ""
curl -N -X POST \
    "$BASE_URL/threads/$THREAD_ID/summarize/stream" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    --no-buffer

