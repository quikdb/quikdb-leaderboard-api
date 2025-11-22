const healthController = require('./health.controller');
const leaderboardController = require('./leaderboard.controller');

module.exports = {
  ...healthController,
  ...leaderboardController,
};
