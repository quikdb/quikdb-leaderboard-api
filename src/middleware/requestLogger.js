/**
 * Request Logger Middleware
 * Logs HTTP requests with method, path, status, and duration
 */

/**
 * Request logger middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const path = req.path;
    const status = res.statusCode;
    
    // Color code by status
    const statusColor = status >= 500 ? '🔴' :
                       status >= 400 ? '🟡' :
                       status >= 300 ? '🔵' :
                       '🟢';
    
    console.log(`${statusColor} ${method} ${path} - ${status} (${duration}ms)`);
  });
  
  next();
};

module.exports = {
  requestLogger,
};
