const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  getNodeRanking,
  getTopNodes,
  refreshLeaderboard,
  getLeaderboardStats,
} = require('../controllers');

/**
 * GET /leaderboard
 * Get the current leaderboard rankings
 */
router.get('/', getLeaderboard);

/**
 * GET /leaderboard/node/:nodeId
 * Get specific node's ranking and stats
 */
router.get('/node/:nodeId', getNodeRanking);

/**
 * GET /leaderboard/top/:count
 * Get top N nodes from the leaderboard
 */
router.get('/top/:count', getTopNodes);

/**
 * POST /leaderboard/refresh
 * Force refresh the leaderboard
 * TODO: Add admin authentication in production
 */
router.post('/refresh', refreshLeaderboard);

/**
 * GET /leaderboard/stats
 * Get leaderboard statistics
 */
router.get('/stats', getLeaderboardStats);

module.exports = router;
