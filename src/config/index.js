const { getConfig } = require('./env');
const { connectDatabase, closeDatabase, getConnectionStatus } = require('./database');

module.exports = {
  getConfig,
  connectDatabase,
  closeDatabase,
  getConnectionStatus,
};
