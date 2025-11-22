const helmet = require('helmet');
const cors = require('cors');

/**
 * Security Middleware
 * Configures CORS and security headers
 */

/**
 * Create CORS middleware
 * @param {Object} config - Configuration object
 * @param {Array} config.allowedOrigins - Array of allowed origins
 * @param {boolean} config.isDevelopment - Development mode flag
 * @returns {Function} Express middleware
 */
const createCorsMiddleware = (config) => {
  const { allowedOrigins, isDevelopment } = config;

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || isDevelopment) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
  });
};

/**
 * Create Helmet security middleware
 * @returns {Function} Express middleware
 */
const createSecurityMiddleware = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
};

module.exports = {
  createCorsMiddleware,
  createSecurityMiddleware,
};
