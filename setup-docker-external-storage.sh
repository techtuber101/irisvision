#!/bin/bash

# Setup script to configure Docker to use external hard drive
# Run this script to move Docker data to your external drive

set -e

echo "🐳 Docker External Storage Setup"
echo "================================="

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS. Please adapt for your system."
    exit 1
fi

# Use DOODLE drive
DRIVE_NAME="DOODLE"
EXTERNAL_DOCKER_PATH="/Volumes/DOODLE/docker"

# Validate external drive exists
if [ ! -d "/Volumes/DOODLE" ]; then
    echo "❌ External drive '/Volumes/DOODLE' not found!"
    echo "Please make sure your DOODLE drive is connected and mounted."
    exit 1
fi

echo "✅ DOODLE drive found at: /Volumes/DOODLE"

# Create docker directory on external drive
echo "📁 Creating docker directory on external drive..."
mkdir -p "$EXTERNAL_DOCKER_PATH"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "🛑 Stopping Docker Desktop..."
osascript -e 'quit app "Docker Desktop"'

# Wait for Docker to stop
echo "⏳ Waiting for Docker to stop..."
sleep 10

# Backup existing Docker data (if it exists)
DEFAULT_DOCKER_PATH="$HOME/Library/Containers/com.docker.docker/Data"
if [ -d "$DEFAULT_DOCKER_PATH" ]; then
    echo "💾 Backing up existing Docker data..."
    cp -R "$DEFAULT_DOCKER_PATH" "$EXTERNAL_DOCKER_PATH/backup-$(date +%Y%m%d-%H%M%S)"
fi

# Create daemon.json with external path
DAEMON_JSON_PATH="$HOME/.docker/daemon.json"
mkdir -p "$HOME/.docker"

echo "📝 Creating daemon.json configuration..."
cat > "$DAEMON_JSON_PATH" << EOF
{
  "data-root": "$EXTERNAL_DOCKER_PATH",
  "storage-driver": "overlay2",
  "features": {
    "buildkit": true
  }
}
EOF

echo "✅ daemon.json created at: $DAEMON_JSON_PATH"

# Move existing Docker data to external drive
if [ -d "$DEFAULT_DOCKER_PATH" ]; then
    echo "📦 Moving existing Docker data to external drive..."
    mv "$DEFAULT_DOCKER_PATH" "$EXTERNAL_DOCKER_PATH/data"
fi

echo "🚀 Starting Docker Desktop..."
open -a "Docker Desktop"

echo "⏳ Waiting for Docker to start..."
sleep 15

# Verify Docker is working with new storage location
if docker info >/dev/null 2>&1; then
    echo "✅ Docker is running with external storage!"
    echo "📍 Docker data is now stored at: $EXTERNAL_DOCKER_PATH"
    
    # Show Docker info
    echo ""
    echo "📊 Docker Information:"
    docker system df
else
    echo "❌ Docker failed to start with external storage configuration."
    echo "Please check the Docker Desktop logs and try again."
    exit 1
fi

echo ""
echo "🎉 Setup complete! Docker is now using your external drive for storage."
echo "💡 Remember to keep your external drive connected when using Docker."
