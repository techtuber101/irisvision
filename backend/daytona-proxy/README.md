# Daytona Sandbox Proxy

Custom proxy for Daytona sandboxes that lets Iris serve preview traffic from an organization-owned domain.

## Features

- Subdomain routing using `{port}-{sandboxId}.{SANDBOX_PROXY_DOMAIN}` (for example `8080-abc123.vault.irisvision.ai`)
- Automatic retrieval of Daytona preview tokens
- WebSocket support and explicit `X-Daytona-Skip-Preview-Warning` headers
- Error fallback page ready for production

## Configuration

Environment variables:

- `DAYTONA_API_KEY` (**required**): Daytona API key with access to the sandbox.
- `DAYTONA_API_URL` (optional): Override the Daytona API base URL. Defaults to `https://app.daytona.io/api`.
- `PORT` (optional): Listening port, defaults to `1234`.
- `PREVIEW_CACHE_TTL_MS` (optional): TTL for cached Daytona preview lookups in milliseconds (defaults to 60000).

For local testing:

```bash
npm install
npm run dev
# Then open http://8080-your-sandbox-id.localhost:1234
```

Container image is built via the accompanying `Dockerfile` and consumed by the root `docker-compose` services.
