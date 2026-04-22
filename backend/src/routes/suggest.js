import express from 'express';
import fetch from 'node-fetch';

import config from '../config.js';
import validateSuggestRequest from '../middleware/validate.js';

const MAPY_CZ_SUGGEST_URL = 'https://api.mapy.cz/v1/suggest';

const router = express.Router();

router.get('/', validateSuggestRequest, async (req, res, next) => {
  try {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(req.validatedQuery)) {
      params.set(key, value);
    }

    params.set('apikey', config.mapyCzApiKey);

    const upstreamResponse = await fetch(`${MAPY_CZ_SUGGEST_URL}?${params.toString()}`, {
      headers: {
        Accept: 'application/json'
      }
    });

    const body = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type');

    if (contentType) {
      res.set('content-type', contentType);
    }

    return res.status(upstreamResponse.status).send(body);
  } catch (error) {
    return next(error);
  }
});

export default router;
