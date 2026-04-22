const ALLOWED_QUERY_PARAMS = ['query', 'lang', 'limit', 'type', 'locality'];
const MAX_QUERY_LENGTH = 200;

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim();
}

export default function validateSuggestRequest(req, res, next) {
  const sanitized = {};
  const query = sanitizeString(req.query.query);

  if (!query) {
    return res.status(400).json({ error: 'The "query" parameter is required.' });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res
      .status(400)
      .json({ error: `The "query" parameter must be at most ${MAX_QUERY_LENGTH} characters.` });
  }

  sanitized.query = query;

  if (req.query.limit !== undefined) {
    const limit = Number.parseInt(String(req.query.limit), 10);

    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return res.status(400).json({ error: 'The "limit" parameter must be an integer between 1 and 20.' });
    }

    sanitized.limit = String(limit);
  }

  for (const key of ALLOWED_QUERY_PARAMS) {
    if (key === 'query' || key === 'limit') {
      continue;
    }

    const value = sanitizeString(req.query[key]);

    if (value) {
      sanitized[key] = value;
    }
  }

  req.validatedQuery = sanitized;
  return next();
}
