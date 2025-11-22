require('dotenv').config();

/**
 * Environment Configuration Validator
 * Ensures all required environment variables are set before app starts
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'PORT',
  'NODE_ENV',
  'API_KEY'
];

const optionalEnvVars = {
  CORS_ALLOWED_ORIGINS: 'https://nodes.quikdb.com,http://localhost:3000',
  RATE_LIMIT_MAX: '200',
  LEADERBOARD_UPDATE_INTERVAL_MS: '60000'
};

/**
 * Validate required environment variables
 * @throws {Error} if any required variable is missing
 */
const validateEnv = () => {
  const missing = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables:\n` +
      missing.map(v => `   - ${v}`).join('\n') +
      `\n\nPlease set these variables in your .env file or environment.`
    );
  }

  // Set defaults for optional variables
  Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      console.log(`⚙️  Using default for ${key}: ${defaultValue}`);
    }
  });

  console.log('✅ Environment validation passed');
};

/**
 * Get environment configuration
 * @returns {Object} Configuration object
 */
const getConfig = () => {
  validateEnv();

  return {
    mongodb: {
      uri: process.env.MONGODB_URI,
    },
    server: {
      port: parseInt(process.env.PORT, 10),
      nodeEnv: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      isDevelopment: process.env.NODE_ENV === 'development',
    },
    auth: {
      apiKey: process.env.API_KEY,
    },
    cors: {
      allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
        .split(',')
        .map(origin => origin.trim()),
    },
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX, 10),
    },
    leaderboard: {
      updateIntervalMs: parseInt(process.env.LEADERBOARD_UPDATE_INTERVAL_MS, 10),
    },
  };
};

module.exports = {
  validateEnv,
  getConfig,
};
