const mongoose = require('mongoose');

/**
 * Database Configuration
 * Handles MongoDB connection with app name and connection options
 */

/**
 * Connect to MongoDB with app name
 * @param {string} uri - MongoDB connection URI
 * @param {string} appName - Application name for MongoDB connection
 * @returns {Promise<void>}
 */
const connectDatabase = async (uri, appName = 'quikdb-leaderboard-api') => {
  try {
    console.log('📦 Connecting to MongoDB...');
    
    const options = {
      appName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    };

    await mongoose.connect(uri, options);
    
    console.log(`✅ Connected to MongoDB (appName: ${appName})`);
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    
    // Set up connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    throw error;
  }
};

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const closeDatabase = async () => {
  try {
    console.log('💾 Closing database connection...');
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

/**
 * Get connection status
 * @returns {string} Connection state
 */
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

module.exports = {
  connectDatabase,
  closeDatabase,
  getConnectionStatus,
};
