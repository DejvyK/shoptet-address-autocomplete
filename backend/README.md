# Backend Proxy

This document describes the supported `production installation` via `backend proxy`.

For a live shop, the `browser script` should call your merchant-managed `/suggest` endpoint, not `https://api.mapy.cz/v1/suggest` directly. The `backend proxy` is the only place where `MAPY_CZ_API_KEY` exists in production.
In the current repository state, `naseptavac-shoptet.js` still calls Mapy.cz directly, so moving to this `production installation` requires adapting that browser-side request in the script.

Production request flow:

1. Shoptet loads the `browser script`
2. The `browser script` calls your backend `/suggest` endpoint
3. The `backend proxy` appends `MAPY_CZ_API_KEY` server-side and forwards the request to Mapy.cz

This backend keeps the Mapy.cz API key on the server, applies CORS allowlisting through `ALLOWED_ORIGINS`, rate limits `/suggest`, and forwards only a validated subset of query parameters to `https://api.mapy.cz/v1/suggest`.

## Features

- `GET /suggest` proxy for the Mapy.cz suggest API
- `helmet()` for common security headers
- Per-IP rate limit of `60` requests per minute on `/suggest`
- Strict CORS allowlist via `ALLOWED_ORIGINS`
- Query validation and sanitization before forwarding
- Centralized error handling without leaking stack traces in production

## Requirements

- Node.js `18+`

## Install

```bash
cd backend
npm install
```

## Configure

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Set the required values in `.env`:

- `MAPY_CZ_API_KEY` - required, server startup fails if missing
- `PORT` - backend port, defaults to `3001` if unset
- `ALLOWED_ORIGINS` - comma-separated list of allowed frontend origins
- `NODE_ENV` - typically `development` or `production`

Example:

```env
MAPY_CZ_API_KEY=your_real_key_here
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://your-store.example
NODE_ENV=production
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3001/health
```

Example suggest request:

```bash
curl "http://localhost:3001/suggest?query=Praha&limit=5"
```

## Frontend Update

Update the `browser script` so it calls this `backend proxy` instead of `https://api.mapy.cz/v1/suggest` directly from the browser.
The current repository does not yet ship a standalone backend-endpoint setting, so this is a small code adaptation in `naseptavac-shoptet.js`, not a documented toggle.

Current frontend flow:

- Browser calls Mapy.cz directly
- `MAPY_CZ_API_KEY` is exposed in client-side JavaScript

Recommended new flow:

- `browser script` calls your backend endpoint, for example `/suggest?query=Praha&limit=5`
- `backend proxy` injects `MAPY_CZ_API_KEY` server-side
- `backend proxy` forwards only these whitelisted params: `query`, `lang`, `limit`, `type`, `locality`

For local development, a frontend request should point to:

```text
http://localhost:3001/suggest
```

For production, point the frontend to the deployed backend URL, for example:

```text
https://your-backend.example/suggest
```

Migration note for existing users:

- Stop embedding `MAPY_CZ_API_KEY` in storefront JavaScript
- Repoint the `browser script` to your deployed backend `/suggest` endpoint
- Set `ALLOWED_ORIGINS` to the storefront origins that should be allowed to call the proxy

## Notes

- Requests with a `query` longer than `200` characters are rejected
- `limit` must be an integer between `1` and `20`
- Unexpected query params are ignored and never forwarded upstream
- Origins not listed in `ALLOWED_ORIGINS` are rejected by CORS when an `Origin` header is present
