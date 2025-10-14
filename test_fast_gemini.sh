#!/bin/bash

echo "=========================================="
echo "Fast Gemini 2.5 Flash Speed Test"
echo "=========================================="
echo ""

echo "Test 1: Health Check"
echo "--------------------"
curl -s http://localhost:8000/api/chat/fast-gemini-chat/health | jq .
echo ""

echo "Test 2: Non-Streaming Chat (3 runs)"
echo "------------------------------------"
for i in {1..3}; do
    echo "Run $i:"
    curl -s -X POST http://localhost:8000/api/chat/fast-gemini-chat \
      -H "Content-Type: application/json" \
      -d '{"message": "What is 2+2?"}' | jq -r '"Response time: \(.time_ms)ms | Answer: \(.response | split("\n")[0])"'
    echo ""
done

echo "Test 3: Streaming Chat"
echo "----------------------"
echo "Message: Tell me a one-line fact about Python"
echo ""
curl -N -s -X POST http://localhost:8000/api/chat/fast-gemini-chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me a one-line fact about Python"}' | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
        data="${line#data: }"
        type=$(echo "$data" | jq -r '.type')
        if [ "$type" = "chunk" ]; then
            echo -n "$(echo "$data" | jq -r '.content')"
        elif [ "$type" = "done" ]; then
            echo ""
            echo ""
            echo "$(echo "$data" | jq -r '"Total time: \(.time_ms)ms"')"
        fi
    fi
done

echo ""
echo "=========================================="
echo "Speed Test Complete!"
echo "=========================================="

