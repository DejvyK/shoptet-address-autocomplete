import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

function parsePort(value) {
  if (!value) {
    return 3001;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Invalid PORT value. PORT must be a positive integer.');
  }

  return port;
}

function parseAllowedOrigins(value) {
  if (!value || !value.trim()) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return origins;
}

const mapyCzApiKey = process.env.MAPY_CZ_API_KEY?.trim();

if (!mapyCzApiKey) {
  throw new Error(
    'Missing required environment variable MAPY_CZ_API_KEY. Set it in backend/.env before starting the server.'
  );
}

const config = {
  env: process.env.NODE_ENV?.trim() || 'development',
  port: parsePort(process.env.PORT),
  mapyCzApiKey,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
};

export default config;
