FROM caddy:builder AS builder

# Build Caddy with Cloudflare DNS plugin so we can solve wildcard certificates via DNS-01
RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

FROM caddy:alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Caddyfile will be mounted by docker-compose; no need to COPY here.
