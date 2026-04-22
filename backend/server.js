import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './src/config.js';
import errorHandler from './src/middleware/errorHandler.js';
import suggestRouter from './src/routes/suggest.js';

const app = express();

const allowedOrigins = new Set(config.allowedOrigins);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    const error = new Error('Origin not allowed by CORS policy.');
    error.status = 403;
    error.expose = true;
    return callback(error);
  }
};

const suggestRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' }
});

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/suggest', suggestRateLimit, suggestRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
