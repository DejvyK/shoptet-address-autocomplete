# Backend Proxy

Production-oriented Node.js proxy for the Shoptet address autocomplete integration. It keeps the Mapy.cz API key on the server and forwards only a validated subset of query parameters to `https://api.mapy.cz/v1/suggest`.

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

Update the frontend so it calls this backend instead of `https://api.mapy.cz/v1/suggest` directly from the browser.

Current frontend flow:

- Browser calls Mapy.cz directly
- API key is exposed in client-side JavaScript

Recommended new flow:

- Browser calls your backend endpoint, for example `/suggest?query=Praha&limit=5`
- Backend injects `MAPY_CZ_API_KEY` server-side
- Backend forwards only these whitelisted params: `query`, `lang`, `limit`, `type`, `locality`

For local development, a frontend request should point to:

```text
http://localhost:3001/suggest
```

For production, point the frontend to the deployed backend URL, for example:

```text
https://your-backend.example/suggest
```

## Notes

- Requests with a `query` longer than `200` characters are rejected
- `limit` must be an integer between `1` and `20`
- Unexpected query params are ignored and never forwarded upstream
- Origins not listed in `ALLOWED_ORIGINS` are rejected by CORS when an `Origin` header is present
