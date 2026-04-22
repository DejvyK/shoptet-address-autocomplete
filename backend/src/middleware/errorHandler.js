export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const payload = {
    error: err.expose ? err.message : 'Internal server error'
  };

  if (!isProduction && !err.expose) {
    payload.details = err.message;
  }

  return res.status(statusCode).json(payload);
}
