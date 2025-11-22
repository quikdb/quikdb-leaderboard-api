const express = require('express');

// Config
const { getConfig, connectDatabase, closeDatabase } = require('./config');

// Services
const leaderboardService = require('./services/leaderboard');

// Routes
const leaderboardRoutes = require('./routes/leaderboard');

// Controllers
const { getHealth, getMetrics } = require('./controllers');

// Middleware
const {
  createRateLimiter,
  errorHandler,
  notFoundHandler,
  requestLogger,
  createCorsMiddleware,
  createSecurityMiddleware,
  createApiKeyAuth,
} = require('./middleware');

class LeaderboardAPI {
  constructor() {
    this.app = express();
    this.server = null;
    this.isShuttingDown = false;
    this.config = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  setupMiddleware() {
    // Get validated configuration
    this.config = getConfig();

    // Trust proxy for deployment platforms
    if (this.config.server.isProduction) {
      this.app.set('trust proxy', 1);
      console.log('🔗 Express configured to trust proxy (production mode)');
    }

    // Security headers
    this.app.use(createSecurityMiddleware());

    // CORS
    this.app.use(createCorsMiddleware({
      allowedOrigins: this.config.cors.allowedOrigins,
      isDevelopment: this.config.server.isDevelopment
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // API Key Authentication (applied globally, skips /health and /metrics)
    const apiKeyAuth = createApiKeyAuth(this.config.auth.apiKey);
    this.app.use(apiKeyAuth);
    console.log('🔐 API key authentication enabled');

    // Rate limiting
    const leaderboardLimiter = createRateLimiter(this.config.rateLimit);
    this.app.use('/leaderboard', leaderboardLimiter);
    console.log(`🚦 Rate limiting: ${this.config.rateLimit.max} requests/minute`);

    // Request logging
    this.app.use(requestLogger);
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', getHealth);

    // Metrics endpoint
    this.app.get('/metrics', getMetrics);

    // Leaderboard routes
    this.app.use('/leaderboard', leaderboardRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'QuikDB Leaderboard API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: 'GET /health',
          metrics: 'GET /metrics',
          leaderboard: 'GET /leaderboard',
          nodeRanking: 'GET /leaderboard/node/:nodeId',
          topNodes: 'GET /leaderboard/top/:count',
          stats: 'GET /leaderboard/stats',
          refresh: 'POST /leaderboard/refresh'
        }
      });
    });

    // 404 handler
    this.app.use('*', notFoundHandler);
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`🛑 Received ${signal} signal`);
      
      if (this.isShuttingDown) {
        console.log('⚠️ Shutdown already in progress, forcing exit...');
        process.exit(1);
      }
      
      this.isShuttingDown = true;
      
      try {
        // Stop leaderboard service
        console.log('🏆 Stopping leaderboard service...');
        leaderboardService.stop();
        
        // Close server
        if (this.server) {
          console.log('🌐 Closing HTTP server...');
          await new Promise((resolve) => {
            this.server.close(resolve);
          });
        }
        
        // Close database connection
        console.log('💾 Closing database connection...');
        await closeDatabase();
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async start() {
    try {
      // Validate environment and get config
      this.config = getConfig();

      // Connect to MongoDB with app name
      await connectDatabase(this.config.mongodb.uri, 'quikdb-leaderboard-api');

      // Initialize and start leaderboard service
      console.log('🏆 Initializing leaderboard service...');
      await leaderboardService.initialize();
      leaderboardService.start();
      console.log('✅ Leaderboard service started');

      // Start HTTP server
      const port = this.config.server.port;
      this.server = this.app.listen(port, () => {
        console.log('\n🚀 ========================================');
        console.log(`🏆 QuikDB Leaderboard API`);
        console.log(`🌐 Server running on port ${port}`);
        console.log(`📊 Environment: ${this.config.server.nodeEnv}`);
        console.log('🚀 ========================================\n');
        console.log('📍 Available endpoints:');
        console.log(`   • GET  / - API information`);
        console.log(`   • GET  /health - Health check`);
        console.log(`   • GET  /metrics - System metrics`);
        console.log(`   • GET  /leaderboard - Full leaderboard (top 100)`);
        console.log(`   • GET  /leaderboard/node/:nodeId - Specific node ranking`);
        console.log(`   • GET  /leaderboard/top/:count - Top N nodes`);
        console.log(`   • GET  /leaderboard/stats - Leaderboard statistics`);
        console.log(`   • POST /leaderboard/refresh - Force refresh\n`);
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const api = new LeaderboardAPI();
api.start();

module.exports = LeaderboardAPI;
