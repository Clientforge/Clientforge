const config = require('../config');

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  console.error(`[ERROR] ${statusCode} — ${err.message}`);
  if (config.env === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: message,
    ...(config.env === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
