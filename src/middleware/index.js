const { createRateLimiter } = require('./rateLimiter');
const { errorHandler, notFoundHandler } = require('./errorHandler');
const { requestLogger } = require('./requestLogger');
const { createCorsMiddleware, createSecurityMiddleware } = require('./security');
const { createApiKeyAuth } = require('./apiKeyAuth');

module.exports = {
  createRateLimiter,
  errorHandler,
  notFoundHandler,
  requestLogger,
  createCorsMiddleware,
  createSecurityMiddleware,
  createApiKeyAuth,
};
