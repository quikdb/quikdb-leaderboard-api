/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header or api_key query parameter
 */

/**
 * Create API key authentication middleware
 * @param {string} validApiKey - The valid API key to check against
 * @returns {Function} Express middleware function
 */
const createApiKeyAuth = (validApiKey) => {
  return (req, res, next) => {
    // Skip authentication for public endpoints
    const publicPaths = ['/health', '/metrics', '/'];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required',
        message: 'Provide API key in X-API-Key header or api_key query parameter',
      });
    }

    if (apiKey !== validApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid',
      });
    }

    // API key is valid, proceed
    next();
  };
};

module.exports = {
  createApiKeyAuth,
};
