const { getConnectionStatus } = require('../config');

/**
 * Health Check Controller
 * Returns service health status and connectivity
 */

/**
 * GET /health
 * Check service health and dependencies
 */
const getHealth = async (req, res) => {
  try {
    const leaderboardService = require('../services/leaderboard');
    
    // Check database connection
    const dbStatus = getConnectionStatus();
    
    // Check leaderboard service
    const leaderboard = await leaderboardService.getLeaderboard();
    const leaderboardStatus = leaderboard.data.length > 0 ? 'healthy' : 'no data';
    
    const isHealthy = dbStatus === 'connected';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        leaderboard: leaderboardStatus
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * GET /metrics
 * Get system metrics
 */
const getMetrics = (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealth,
  getMetrics,
};
