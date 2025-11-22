const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Middleware
 * Configurable rate limiting for API endpoints
 */

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @returns {Function} Express middleware
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 200,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  createRateLimiter,
};
