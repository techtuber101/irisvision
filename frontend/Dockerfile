# syntax=docker.io/docker/dockerfile:1
# ---- Base Stage ----
FROM node:22-slim AS base

# Install dependencies only when needed
FROM base AS deps

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

# Make installs more resilient to transient network failures
ENV npm_config_loglevel=warn \
    npm_config_progress=false \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_factor=2 \
    npm_config_fetch_retry_maxtimeout=600000 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_network_timeout=600000

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN set -e; \
  if [ -f yarn.lock ]; then \
    for i in 1 2 3; do yarn --frozen-lockfile && break || (echo "yarn install failed (attempt $i), retrying in 10s" && sleep 10); done; \
  elif [ -f package-lock.json ]; then \
    npm config set fund false; \
    npm config set audit false; \
    for i in 1 2 3; do npm ci && break || (echo "npm ci failed (attempt $i), retrying in 10s" && sleep 10); done; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm; \
    for i in 1 2 3; do pnpm i --frozen-lockfile && break || (echo "pnpm install failed (attempt $i), retrying in 10s" && sleep 10); done; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi


# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ---- Runner Stage ----
FROM base AS runner
WORKDIR /app

ENV NEXT_PUBLIC_VERCEL_ENV=production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]