import express, { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Configuration, SandboxApi } from '@daytonaio/api-client';
import dotenv from 'dotenv';
import path from 'path';
import type { ClientRequest } from 'http';

dotenv.config({ override: true });

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
const DAYTONA_API_URL = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';
const APP_PORT = Number(process.env.PORT || 1234);
const CACHE_TTL_MS = Number(process.env.PREVIEW_CACHE_TTL_MS || 100_000);

if (!DAYTONA_API_KEY) {
  throw new Error('DAYTONA_API_KEY is not set');
}

const sandboxApi = new SandboxApi(
  new Configuration({
    basePath: DAYTONA_API_URL,
    baseOptions: {
      headers: {
        Authorization: `Bearer ${DAYTONA_API_KEY}`,
      },
    },
  }),
);

const ERROR_PAGE_PATH = path.join(__dirname, 'error.html');

type CacheEntry = {
  url: string;
  token?: string;
  expiresAt: number;
};

const previewCache = new Map<string, CacheEntry>();

const pruneExpired = () => {
  const now = Date.now();
  for (const [key, entry] of previewCache.entries()) {
    if (entry.expiresAt <= now) {
      previewCache.delete(key);
    }
  }
};

function parseHost(host?: string) {
  if (!host) {
    throw new Error('Missing host header');
  }

  const [subdomain] = host.split(':'); // Remove optional port
  const segments = subdomain.split('.');
  if (!segments.length) {
    throw new Error(`Invalid host: ${host}`);
  }

  const [portPart, ...sandboxParts] = segments[0].split('-');
  if (!portPart || sandboxParts.length === 0) {
    throw new Error(`Invalid sandbox host: ${host}`);
  }

  const port = Number(portPart);
  if (Number.isNaN(port)) {
    throw new Error(`Invalid sandbox port: ${portPart}`);
  }

  return {
    port,
    sandboxId: sandboxParts.join('-'),
  };
}

const attachPreviewHeaders = (
  proxyReq: ClientRequest,
  req: Request & { _daytonaError?: unknown; _previewToken?: string },
  onError: (err: unknown) => void,
) => {
  if (req._daytonaError) {
    console.error('Unable to proxy request:', req._daytonaError);
    onError(req._daytonaError);
    return;
  }

  if (req._previewToken) {
    proxyReq.setHeader('X-Daytona-Preview-Token', req._previewToken);
    proxyReq.setHeader('X-Daytona-Skip-Preview-Warning', 'true');
  }
};

const proxyMiddleware = createProxyMiddleware<Request, Response>({
  changeOrigin: true,
  autoRewrite: true,
  ws: true,
  xfwd: true,
  router: async (req) => {
    try {
      const host = req.headers.host ?? '';
      const cacheKey = host.toLowerCase();
      const cached = previewCache.get(cacheKey);
      const now = Date.now();

      if (cached && cached.expiresAt > now) {
        (req as Request & { _previewToken?: string })._previewToken = cached.token;
        return cached.url;
      }

      const { sandboxId, port } = parseHost(host);
      const response = await sandboxApi.getPortPreviewUrl(sandboxId, port);

      previewCache.set(cacheKey, {
        url: response.data.url,
        token: response.data.token ?? undefined,
        expiresAt: now + CACHE_TTL_MS,
      });

      if (previewCache.size > 100) {
        pruneExpired();
      }

      // Store token so proxyReq hook can attach it.
      (req as Request & { _previewToken?: string })._previewToken = response.data.token ?? undefined;
      return response.data.url;
    } catch (error) {
      (req as Request & { _daytonaError?: unknown })._daytonaError = error;
      return 'http://127.0.0.1';
    }
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      attachPreviewHeaders(
        proxyReq,
        req as Request & { _daytonaError?: unknown; _previewToken?: string },
        () => res.status(502).sendFile(ERROR_PAGE_PATH),
      );
    },
    proxyReqWs: (proxyReq, req, socket) => {
      attachPreviewHeaders(
        proxyReq,
        req as Request & { _daytonaError?: unknown; _previewToken?: string },
        () => socket.end(),
      );
    },
    proxyRes: (proxyRes, req, res) => {
      if (!proxyRes.statusCode || proxyRes.statusCode >= 400) {
        console.error(
          `Sandbox proxy error for ${req.headers.host}: ${proxyRes.statusCode} ${proxyRes.statusMessage}`,
        );
        res.status(502).sendFile(ERROR_PAGE_PATH);
      }
    },
    error: (err, req, res) => {
      console.error('Proxy error:', err);
      // res can be Response (HTTP) or Socket (WebSocket)
      if ('status' in res && !res.headersSent) {
        res.status(502).sendFile(ERROR_PAGE_PATH);
      }
    },
  },
});

const app = express();

app.use(proxyMiddleware);

app.listen(APP_PORT, () => {
  console.log(`Daytona proxy listening on port ${APP_PORT}`);
});
