#!/bin/bash

echo "Waiting for Docker daemon to be ready..."

# Wait for Docker to be available (max 60 seconds)
for i in {1..60}; do
    if docker ps > /dev/null 2>&1; then
        echo "Docker is ready!"
        break
    fi
    echo "Waiting for Docker... ($i/60)"
    sleep 1
done

# Check if Docker is ready
if ! docker ps > /dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Please start Docker Desktop manually."
    exit 1
fi

echo "Starting docker compose..."
cd /Users/ishaantheman/irissecond
docker compose -f docker-compose.local.yaml up --build


