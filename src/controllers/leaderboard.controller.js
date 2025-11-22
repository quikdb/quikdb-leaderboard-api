const leaderboardService = require('../services/leaderboard');

/**
 * Leaderboard Controller
 * Handles all leaderboard-related requests
 */

/**
 * GET /leaderboard
 * Get the current leaderboard rankings (top 100)
 */
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await leaderboardService.getLeaderboard();
    
    res.json({
      success: true,
      data: leaderboard.data,
      metadata: {
        totalNodes: leaderboard.totalNodes,
        lastUpdated: leaderboard.lastUpdated,
        timestamp: leaderboard.timestamp,
        fieldMetadata: leaderboard.fieldMetadata
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
};

/**
 * GET /leaderboard/node/:nodeId
 * Get specific node's ranking and stats
 */
const getNodeRanking = async (req, res) => {
  try {
    const { nodeId } = req.params;
    const leaderboard = await leaderboardService.getLeaderboard();
    
    // Search in allNodes instead of just top 100
    const nodeData = leaderboard.allNodes.find(node => node.nodeId === nodeId);
    
    if (!nodeData) {
      return res.status(404).json({
        success: false,
        error: 'Node not found in leaderboard'
      });
    }

    res.json({
      success: true,
      data: nodeData,
      metadata: {
        totalNodes: leaderboard.totalNodes,
        lastUpdated: leaderboard.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error fetching node ranking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch node ranking'
    });
  }
};

/**
 * GET /leaderboard/top/:count
 * Get top N nodes from the leaderboard
 */
const getTopNodes = async (req, res) => {
  try {
    const count = Math.min(parseInt(req.params.count) || 10, 100); // Max 100
    const leaderboard = await leaderboardService.getLeaderboard();
    
    const topNodes = leaderboard.data.slice(0, count);
    
    res.json({
      success: true,
      data: topNodes,
      metadata: {
        requestedCount: count,
        returnedCount: topNodes.length,
        totalNodes: leaderboard.totalNodes,
        lastUpdated: leaderboard.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error fetching top nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top nodes'
    });
  }
};

/**
 * POST /leaderboard/refresh
 * Force refresh the leaderboard
 * TODO: Add admin authentication in production
 */
const refreshLeaderboard = async (req, res) => {
  try {
    // In production, add admin authentication here
    // const adminToken = req.headers.authorization;
    // if (!isValidAdminToken(adminToken)) {
    //   return res.status(403).json({ success: false, error: 'Unauthorized' });
    // }
    
    await leaderboardService.forceUpdate();
    
    res.json({
      success: true,
      message: 'Leaderboard refresh initiated'
    });
  } catch (error) {
    console.error('Error refreshing leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh leaderboard'
    });
  }
};

/**
 * GET /leaderboard/stats
 * Get leaderboard statistics
 */
const getLeaderboardStats = async (req, res) => {
  try {
    const leaderboard = await leaderboardService.getLeaderboard();
    
    if (leaderboard.data.length === 0) {
      return res.json({
        success: true,
        data: {
          totalNodes: 0,
          averageScore: 0,
          topScore: 0,
          lastUpdated: leaderboard.lastUpdated,
          scoreDistribution: {
            excellent: 0,
            good: 0,
            average: 0,
            poor: 0
          }
        }
      });
    }

    // Use allNodes for accurate stats across entire network
    const allNodesData = leaderboard.allNodes || leaderboard.data;
    const actualTotalNodes = allNodesData.length;
    const scores = allNodesData.map(node => node.reputationScore);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const topScore = Math.max(...scores);
    
    // Count status distribution from cached status field
    const statusCounts = allNodesData.reduce((acc, node) => {
      const status = node.status || 'excellent';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { excellent: 0, good: 0, average: 0, poor: 0 });
    
    res.json({
      success: true,
      data: {
        totalNodes: actualTotalNodes,
        averageScore: Math.round(averageScore * 100) / 100,
        topScore: topScore,
        lastUpdated: leaderboard.lastUpdated,
        scoreDistribution: statusCounts
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard stats'
    });
  }
};

module.exports = {
  getLeaderboard,
  getNodeRanking,
  getTopNodes,
  refreshLeaderboard,
  getLeaderboardStats,
};
