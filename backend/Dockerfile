FROM ghcr.io/astral-sh/uv:python3.11-alpine

ENV ENV_MODE production
WORKDIR /app

# Install system dependencies in stages to avoid I/O issues
RUN apk update && apk add --no-cache \
    curl \
    git \
    # Basic build tools
    build-base \
    linux-headers

# Install Python development dependencies
# Update package index and install with retry to handle I/O errors
RUN for i in 1 2 3; do \
        apk update && apk add --no-cache \
            freetype-dev \
            gcc \
            musl-dev \
            python3-dev && break || \
        (echo "Python dev dependencies installation attempt $i failed, retrying..." && sleep 5); \
    done

# Install Rust compiler separately to avoid conflicts
# Try installing Rust with retry mechanism to handle I/O errors
RUN for i in 1 2 3; do \
        apk add --no-cache rust cargo && break || \
        (echo "Rust installation attempt $i failed, retrying..." && sleep 5); \
    done || echo "Rust installation failed, continuing without it"

# Set Rust environment variables to optimize compilation
ENV RUSTFLAGS="-C target-cpu=native"
ENV CARGO_BUILD_JOBS=2

# Install Python dependencies
COPY pyproject.toml uv.lock ./
ENV UV_LINK_MODE=copy
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x scripts/startup.sh

# Calculate optimal worker count based on 16 vCPUs
# Using (2*CPU)+1 formula for CPU-bound applications
ENV WORKERS=7
ENV THREADS=2
ENV WORKER_CONNECTIONS=2000

ENV PYTHONPATH=/app
EXPOSE 8000

# Run startup script which updates default agents and starts gunicorn
CMD ["./scripts/startup.sh"]