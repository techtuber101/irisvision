#!/bin/sh
set -e

echo "🚀 Starting Iris backend..."

# Run default agent update script
echo "🔄 Updating default Iris agents..."
uv run python scripts/update_default_agents.py || {
    echo "⚠️  Warning: Failed to update default agents, continuing anyway..."
}

echo "✅ Startup checks complete, starting application..."

# Start the main application with the original CMD
exec uv run gunicorn api:app \
  --workers ${WORKERS:-7} \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 1800 \
  --graceful-timeout 600 \
  --keep-alive 1800 \
  --max-requests 0 \
  --max-requests-jitter 0 \
  --forwarded-allow-ips '*' \
  --worker-connections ${WORKER_CONNECTIONS:-2000} \
  --worker-tmp-dir /dev/shm \
  --preload \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --enable-stdio-inheritance \
  --threads ${THREADS:-2}


