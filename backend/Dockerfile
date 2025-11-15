FROM ghcr.io/astral-sh/uv:python3.11-alpine

ENV ENV_MODE production
WORKDIR /app

# Install system dependencies in stages to avoid I/O issues
# Use retry logic to handle network/SSL issues
RUN for i in 1 2 3 4 5; do \
        apk update && \
        apk add --no-cache \
            curl \
            git \
            build-base \
            linux-headers && \
        break || \
        (echo "Package installation attempt $i failed, retrying in 5 seconds..." && sleep 5); \
    done

# Install Python development dependencies with retry logic
RUN for i in 1 2 3 4 5; do \
        apk update && \
        apk add --no-cache \
            freetype-dev \
            gcc \
            musl-dev \
            python3-dev \
            cairo-dev \
            pkgconfig && \
        break || \
        (echo "Python dependencies installation attempt $i failed, retrying in 5 seconds..." && sleep 5); \
    done

# Install Rust compiler separately to avoid conflicts
# Try installing Rust with retry mechanism to handle I/O errors
RUN for i in 1 2 3 4 5; do \
        apk update && \
        apk add --no-cache rust cargo && \
        break || \
        (echo "Rust installation attempt $i failed, retrying in 5 seconds..." && sleep 5); \
    done || echo "Rust installation failed, continuing without it"

# Set Rust environment variables to optimize compilation
ENV RUSTFLAGS="-C target-cpu=native"
ENV CARGO_BUILD_JOBS=2

# Install Python dependencies
COPY pyproject.toml uv.lock ./
ENV UV_LINK_MODE=copy
# Build without cache mount to avoid corrupted setuptools wheel
RUN uv sync --locked

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