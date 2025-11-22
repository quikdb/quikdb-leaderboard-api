// services/leaderboardService.js
const mongoose = require('mongoose');
const DeviceHeartbeat = require('../models/deviceHeartbeat');

/**
 * Leaderboard Service
 * Calculates and caches node reputation scores based on heartbeat data
 */
class LeaderboardService {
  constructor() {
    this.cacheCollection = null;
    this.updateInterval = null;
    this.isRunning = false;
    this.isUpdating = false;
  }

  /**
   * Initialize the leaderboard service
   */
  async initialize() {
    try {
      // Create cache collection if it doesn't exist
      this.cacheCollection = mongoose.connection.db.collection('leaderboard_cache');

      // Create TTL index for automatic cleanup
      await this.cacheCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

      console.log('✅ Leaderboard service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize leaderboard service:', error);
      return false;
    }
  }

  /**
   * Start the leaderboard update process
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Leaderboard service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting leaderboard service...');

    // Initial calculation
    this.updateLeaderboard();

    // Set up periodic updates every 60 seconds (increased from 30s for standalone service)
    const updateIntervalMs = process.env.LEADERBOARD_UPDATE_INTERVAL_MS || 60000;
    this.updateInterval = setInterval(() => {
      this.updateLeaderboard();
    }, updateIntervalMs);

    console.log(`💓 Leaderboard service started - updating every ${updateIntervalMs / 1000} seconds`);
  }

  /**
   * Stop the leaderboard update process
   */
  stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping leaderboard service...');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Wait for any ongoing update to complete
    if (this.isUpdating) {
      console.log('⏳ Waiting for ongoing leaderboard update to complete...');
      // Give ongoing operations a chance to complete gracefully
      let waitCount = 0;
      const checkInterval = setInterval(() => {
        waitCount++;
        if (!this.isUpdating || waitCount > 10) { // Max 5 seconds wait
          clearInterval(checkInterval);
          console.log('🛑 Leaderboard service stopped');
        }
      }, 500);
    } else {
      console.log('🛑 Leaderboard service stopped');
    }
  }

  /**
   * Calculate and update the leaderboard cache
   */
  async updateLeaderboard() {
    // Check if service is shutting down
    if (!this.isRunning) {
      console.log('⚠️ Leaderboard service is stopping, skipping update');
      return;
    }

    if (this.isUpdating) {
      console.log('⚠️ Leaderboard update already in progress, skipping...');
      return;
    }

    // Check if service is initialized
    if (!this.cacheCollection) {
      console.error('❌ Leaderboard service not initialized, skipping update');
      return;
    }

    this.isUpdating = true;
    try {
      console.log('🔄 Calculating leaderboard...');

      // Early exit check during calculation
      if (!this.isRunning) {
        console.log('⚠️ Leaderboard service stopping, aborting update');
        return;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      // MongoDB aggregation pipeline to calculate reputation scores
      const leaderboard = await DeviceHeartbeat.aggregate([
        // 1) Window: last 7 days
        { $match: { timestamp: { $gte: sevenDaysAgo } } },

        // 2) Bucket by hour to count DISTINCT online hours (fair availability)
        {
          $addFields: {
            hourBucket: { $dateTrunc: { date: '$timestamp', unit: 'hour' } },
            isRecent: { $gte: ['$timestamp', twoDaysAgo] },
          },
        },

        // 3) Group by device, compute metrics
        {
          $group: {
            _id: '$deviceId',

            // DISTINCT hours online in the 7d window
            hoursOnlineSet: { $addToSet: '$hourBucket' },

            // Activity
            totalHeartbeats: { $sum: 1 },
            recentHeartbeats: {
              $sum: { $cond: [{ $eq: ['$isRecent', true] }, 1, 0] },
            },

            // Network metrics: only average when present
            avgNetworkSpeed: {
              $avg: {
                $cond: [{ $gt: ['$networkMetrics.speed', null] }, '$networkMetrics.speed', null],
              },
            },
            avgLatency: {
              $avg: {
                $cond: [{ $gt: ['$networkMetrics.latency', null] }, '$networkMetrics.latency', null],
              },
            },

            // System resource metrics (keep optional)
            avgCpuUsageRaw: {
              $avg: {
                $cond: [{ $gt: ['$systemResources.cpu.usage', null] }, '$systemResources.cpu.usage', null],
              },
            },
            avgMemoryUsage: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$systemResources.memory.used', null] },
                      { $gt: ['$systemResources.memory.total', null] },
                      { $gt: ['$systemResources.memory.total', 0] },
                    ],
                  },
                  {
                    $multiply: [{ $divide: ['$systemResources.memory.used', '$systemResources.memory.total'] }, 100],
                  },
                  null,
                ],
              },
            },
            avgDiskUsage: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$systemResources.storage.used', null] },
                      { $gt: ['$systemResources.storage.total', null] },
                      { $gt: ['$systemResources.storage.total', 0] },
                    ],
                  },
                  {
                    $multiply: [{ $divide: ['$systemResources.storage.used', '$systemResources.storage.total'] }, 100],
                  },
                  null,
                ],
              },
            },

            // Time tracking
            lastSeen: { $max: '$timestamp' },
            firstSeen: { $min: '$timestamp' },

            // Uptime
            maxUptime: { $max: '$status.uptime' },
          },
        },

        // 4) Lookup device info once (name/country/createdAt/walletAddress)
        {
          $lookup: {
            from: 'devices',
            localField: '_id',
            foreignField: 'deviceId',
            as: 'deviceInfoArr',
          },
        },
        { $addFields: { 
          deviceInfo: { $arrayElemAt: ['$deviceInfoArr', 0] },
          walletAddress: { $arrayElemAt: ['$deviceInfoArr.walletAddress', 0] }
        } },

        // 5) Derived metrics + scores
        {
          $addFields: {
            // Hours online over 7d (0..168)
            hoursOnline7d: { $size: { $ifNull: ['$hoursOnlineSet', []] } },
            hoursOnlinePerDay: { $divide: [{ $ifNull: ['$hoursOnline7d', 0] }, 7] },

            // Days in window
            daysInWindow: {
              $max: [{ $divide: [{ $subtract: ['$lastSeen', '$firstSeen'] }, 86400000] }, 0],
            },

            // Recency
            hoursSinceLastSeen: {
              $divide: [{ $subtract: ['$$NOW', '$lastSeen'] }, 3600000],
            },

            // Minimum "has been truly online" gate: 30 mins in any single streak
            meetsMinimumUptime: { $gte: [{ $ifNull: ['$maxUptime', 0] }, 1800] },

            // 30-day requirement flag (for your FE)
            // Uses ORIGINAL createdAt (not affected by resets)
            meetsThirtyDayRequirement: {
              $cond: [
                { $ifNull: ['$deviceInfo.createdAt', false] },
                { $gte: [{ $divide: [{ $subtract: ['$$NOW', '$deviceInfo.createdAt'] }, 86400000] }, 30] },
                false,
              ],
            },

            // Grace period - checks BOTH manual grace flag AND natural device age
            // During grace period, prevents dropping more than one tier from excellent
            // Grace is active if:
            // 1. Device is explicitly in grace period (isInGracePeriod=true AND before gracePeriodEndsAt), OR
            // 2. Device is naturally new (≤7 days since createdAt)
            isNewNode: {
              $or: [
                // Manual grace period from reset
                {
                  $and: [
                    { $eq: [{ $ifNull: ['$deviceInfo.isInGracePeriod', false] }, true] },
                    { $lt: ['$$NOW', { $ifNull: ['$deviceInfo.gracePeriodEndsAt', new Date(0)] }] }
                  ]
                },
                // Natural grace period for genuinely new devices (≤7 days old)
                {
                  $and: [
                    { $ifNull: ['$deviceInfo.createdAt', false] },
                    { $lte: [{ $divide: [{ $subtract: ['$$NOW', '$deviceInfo.createdAt'] }, 86400000] }, 7] }
                  ]
                }
              ]
            },

            // Normalize CPU usage (keep null if missing; neutrality handled later)
            avgCpuUsage: { $ifNull: ['$avgCpuUsageRaw', null] },

            // Cap uptime at 24h (in seconds)
            cappedMaxUptime: { $min: [{ $ifNull: ['$maxUptime', 0] }, 86400] },
          },
        },

        // 6) Component scores — REBALANCED WEIGHTS (sum = 100)
        {
          $addFields: {
            // AVAILABILITY (0..45): distinct hours online dominates rank
            availabilityScore: {
              $cond: [
                { $lt: [{ $ifNull: ['$maxUptime', 0] }, 1800] },
                0,
                {
                  $multiply: [
                    { $min: [{ $divide: [{ $ifNull: ['$hoursOnline7d', 0] }, 154] }, 1] }, // full ~22h/day (154/168)
                    45,
                  ],
                },
              ],
            },

            // NETWORK (0..30): 20 throughput + 10 latency
            networkQualityScore: {
              $add: [
                {
                  $multiply: [{ $min: [{ $divide: [{ $ifNull: ['$avgNetworkSpeed', 0] }, 400] }, 1] }, 20],
                },
                {
                  $multiply: [
                    {
                      $max: [{ $subtract: [1, { $divide: [{ $ifNull: ['$avgLatency', 200] }, 200] }] }, 0],
                    },
                    10,
                  ],
                },
              ],
            },

            // RESOURCE HEADROOM (0..10): small influence, prevents unfair swings
            resourceHeadroomScore: {
              $add: [
                {
                  $multiply: [
                    { $max: [{ $subtract: [1, { $divide: [{ $ifNull: ['$avgCpuUsage', 50] }, 100] }] }, 0] },
                    6,
                  ],
                },
                {
                  $multiply: [
                    { $max: [{ $subtract: [1, { $divide: [{ $ifNull: ['$avgMemoryUsage', 50] }, 100] }] }, 0] },
                    3,
                  ],
                },
                {
                  $multiply: [
                    { $max: [{ $subtract: [1, { $divide: [{ $ifNull: ['$avgDiskUsage', 50] }, 100] }] }, 0] },
                    1,
                  ],
                },
              ],
            },

            // CONSISTENCY (0..15): 12 coverage + 3 recency
            consistencyScore: {
              $add: [
                // Coverage target: 80% of 168 hours (~134 h)
                {
                  $multiply: [
                    {
                      $min: [{ $divide: [{ $ifNull: ['$hoursOnline7d', 0] }, { $multiply: [168, 0.8] }] }, 1],
                    },
                    12,
                  ],
                },
                // Recency decay: full at 0h, zero at 72h (small weight)
                {
                  $cond: [
                    { $gt: [{ $ifNull: ['$hoursSinceLastSeen', 10000] }, 72] },
                    0,
                    {
                      $multiply: [
                        {
                          $max: [{ $subtract: [1, { $divide: [{ $ifNull: ['$hoursSinceLastSeen', 0] }, 72] }] }, 0],
                        },
                        3,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },

        // 7) Final reputation (rounded first to ensure status alignment)
        // TOP-DOWN MODEL: New nodes start at 100, then degrade based on performance
        {
          $addFields: {
            calculatedScore: {
              $add: ['$availabilityScore', '$networkQualityScore', '$resourceHeadroomScore', '$consistencyScore']
            },
            reputationScore: {
              $round: [
                {
                  $cond: [
                    // If new node (≤7 days) AND has minimal/no data, seed at 100
                    {
                      $and: [
                        { $eq: ['$isNewNode', true] },
                        { $lte: [{ $ifNull: ['$totalHeartbeats', 0] }, 10] } // Less than 10 heartbeats
                      ]
                    },
                    100, // Seed new nodes at maximum reputation
                    // Otherwise use calculated score
                    { $add: ['$availabilityScore', '$networkQualityScore', '$resourceHeadroomScore', '$consistencyScore'] }
                  ]
                },
                2
              ],
            },
          },
        },

        // 8) Assign rank badge and status based on rounded score
        // TOP-DOWN MODEL: Start at excellent, degrade down based on performance decay
        {
          $addFields: {
            // Calculate base status from reputation score (excellent → good → average → poor)
            baseStatus: {
              $switch: {
                branches: [
                  { case: { $gte: ['$reputationScore', 75] }, then: 'excellent' },
                  { case: { $gte: ['$reputationScore', 55] }, then: 'good' },
                  { case: { $gte: ['$reputationScore', 40] }, then: 'average' },
                  { case: { $lt: ['$reputationScore', 40] }, then: 'poor' },
                ],
                default: 'excellent', // Default to excellent (new nodes with no data)
              },
            },
            // Apply grace period: during first 7 days, prevent dropping more than 1 tier
            status: {
              $cond: [
                { $eq: ['$isNewNode', true] },
                // Grace period active: clamp status to at worst 'good' (1 tier drop from excellent)
                {
                  $switch: {
                    branches: [
                      { case: { $gte: ['$reputationScore', 75] }, then: 'excellent' },
                      { case: { $gte: ['$reputationScore', 55] }, then: 'good' },
                      // During grace, prevent falling below 'good' even if score < 55
                      { case: { $lt: ['$reputationScore', 55] }, then: 'good' },
                    ],
                    default: 'excellent',
                  },
                },
                // No grace period: apply full status based on score
                {
                  $switch: {
                    branches: [
                      { case: { $gte: ['$reputationScore', 75] }, then: 'excellent' },
                      { case: { $gte: ['$reputationScore', 55] }, then: 'good' },
                      { case: { $gte: ['$reputationScore', 40] }, then: 'average' },
                      { case: { $lt: ['$reputationScore', 40] }, then: 'poor' },
                    ],
                    default: 'excellent',
                  },
                },
              ],
            },
            // Rank badge matches status
            rankBadge: {
              $cond: [
                { $eq: ['$isNewNode', true] },
                // Grace period badges
                {
                  $switch: {
                    branches: [
                      { case: { $gte: ['$reputationScore', 75] }, then: '🏆 Excellent' },
                      { case: { $gte: ['$reputationScore', 55] }, then: '😊 Good' },
                      { case: { $lt: ['$reputationScore', 55] }, then: '😊 Good' },
                    ],
                    default: '🏆 Excellent',
                  },
                },
                // Full status badges
                {
                  $switch: {
                    branches: [
                      { case: { $gte: ['$reputationScore', 75] }, then: '🏆 Excellent' },
                      { case: { $gte: ['$reputationScore', 55] }, then: '😊 Good' },
                      { case: { $gte: ['$reputationScore', 40] }, then: '👍 Average' },
                      { case: { $lt: ['$reputationScore', 40] }, then: '⚠️ Poor' },
                    ],
                    default: '🏆 Excellent',
                  },
                },
              ],
            },
          },
        },

        // 9) Sort with tie-breakers: reputation, then availability (coverage), then more recent
        { $sort: { reputationScore: -1, availabilityScore: -1, hoursSinceLastSeen: 1 } },

        // 10) Rank ALL nodes
        { $group: { _id: null, nodes: { $push: '$$ROOT' } } },
        { $unwind: { path: '$nodes', includeArrayIndex: 'rank' } },
        { $addFields: { 'nodes.rank': { $add: ['$rank', 1] } } },
        { $replaceRoot: { newRoot: '$nodes' } },

        // 11) Project EXACT shape frontend expects
        {
          $project: {
            totalHeartbeats: 1,
            lastSeen: 1,
            maxUptime: 1,
            cappedMaxUptime: 1,
            meetsMinimumUptime: '$meetsMinimumUptime',
            meetsThirtyDayRequirement: '$meetsThirtyDayRequirement',
            rank: 1,
            nodeId: '$_id',
            reputationScore: 1, // Already rounded in step 7

            // raw averages (or null)
            avgNetworkSpeed: {
              $cond: [{ $gt: ['$avgNetworkSpeed', null] }, { $round: ['$avgNetworkSpeed', 2] }, null],
            },
            avgLatency: {
              $cond: [{ $gt: ['$avgLatency', null] }, { $round: ['$avgLatency', 2] }, null],
            },
            avgCpuUsage: {
              $cond: [{ $gt: ['$avgCpuUsage', null] }, { $round: ['$avgCpuUsage', 2] }, null],
            },
            avgMemoryUsage: {
              $cond: [{ $gt: ['$avgMemoryUsage', null] }, { $round: ['$avgMemoryUsage', 2] }, null],
            },
            avgDiskUsage: {
              $cond: [{ $gt: ['$avgDiskUsage', null] }, { $round: ['$avgDiskUsage', 2] }, null],
            },

            // component scores mapped to FE fields
            activityScore: {
              $round: [
                {
                  $multiply: [{ $min: [{ $divide: ['$hoursOnline7d', 168] }, 1] }, 10],
                },
                2,
              ],
            },
            uptimeScore: {
              $round: [
                {
                  $cond: [
                    '$meetsMinimumUptime',
                    { $min: [{ $multiply: [{ $divide: ['$cappedMaxUptime', 86400] }, 10] }, 10] },
                    0,
                  ],
                },
                2,
              ],
            },
            performanceScore: { $round: ['$networkQualityScore', 2] },
            stabilityScore: {
              // 0..15 -> 0..10
              $round: [{ $min: [{ $multiply: [{ $divide: ['$consistencyScore', 15] }, 10] }, 10] }, 2],
            },

            // time/volume helpers
            // NOTE: firstSeen comes from 7-day heartbeat window, not lifetime
            daysInSevenDayWindow: { $round: [{ $divide: [{ $subtract: ['$$NOW', '$firstSeen'] }, 86400000] }, 1] },
            totalHeartbeatsSevenDays: '$totalHeartbeats',
            // For true lifetime metrics, use deviceInfo.createdAt
            daysSinceRegistration: {
              $cond: [
                { $ifNull: ['$deviceInfo.createdAt', false] },
                { $round: [{ $divide: [{ $subtract: ['$$NOW', '$deviceInfo.createdAt'] }, 86400000] }, 1] },
                null
              ]
            },
            hoursSinceLastSeen: { $round: ['$hoursSinceLastSeen', 1] },
            uptimeHours: { $round: [{ $divide: ['$cappedMaxUptime', 3600] }, 1] },

            // device info
            country: { $ifNull: ['$deviceInfo.country', 'Unknown'] },
            location: { $ifNull: ['$deviceInfo.location', ''] },
            deviceName: { $ifNull: ['$deviceInfo.name', '$_id'] },
            walletAddress: 1, // Include wallet address for LSK distribution

            // status and insight already set in step 8 based on rounded score
            status: 1,
            rankBadge: 1,
            performanceInsight: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'excellent'] }, then: 'Excellent - Maintaining peak performance' },
                  { case: { $eq: ['$status', 'good'] }, then: 'Good - Strong and reliable performance' },
                  { case: { $eq: ['$status', 'average'] }, then: 'Average - Performance declining, needs improvement' },
                  { case: { $eq: ['$status', 'poor'] }, then: 'Poor - Significant inactivity or performance issues' },
                ],
                default: 'Excellent - Starting with maximum reputation',
              },
            },

            _id: 0,
          },
        },
      ]);

      // Check if service is still running before caching
      if (!this.isRunning) {
        console.log('⚠️ Leaderboard service stopping, skipping cache update');
        return;
      }

      // Only include devices with heartbeats in the leaderboard
      const combinedLeaderboard = leaderboard;

      console.log(`📊 Leaderboard: ${leaderboard.length} active devices with heartbeats`);

      // Cache the results with both full data and top-100 slice
      const cacheDocument = {
        _id: 'leaderboard_cache',
        timestamp: new Date(),
        allNodes: combinedLeaderboard, // Full ranked list for stats (includes inactive)
        data: combinedLeaderboard.slice(0, 100), // Top 100 for leaderboard display
        totalNodes: combinedLeaderboard.length, // Accurate total count
        expiresAt: new Date(Date.now() + 60000), // Expire in 1 minute
      };

      // Monitor cache size (16MB BSON limit warning)
      const cacheSize = JSON.stringify(cacheDocument).length;
      const cacheSizeMB = (cacheSize / (1024 * 1024)).toFixed(2);
      const bsonLimitMB = 16;
      const warningThresholdMB = 12; // Warn at 75% capacity

      if (cacheSizeMB > warningThresholdMB) {
        console.warn(`⚠️ Leaderboard cache size: ${cacheSizeMB}MB (approaching ${bsonLimitMB}MB BSON limit)`);
        console.warn('   Consider splitting cache or moving to separate collection');
      }

      if (!this.cacheCollection) {
        console.error('❌ Cache collection not initialized, skipping cache update');
        return;
      }

      await this.cacheCollection.replaceOne({ _id: 'leaderboard_cache' }, cacheDocument, { upsert: true });

      console.log(`✅ Leaderboard updated - ${leaderboard.length} nodes ranked (cache: ${cacheSizeMB}MB)`);
    } catch (error) {
      console.error('❌ Failed to update leaderboard:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Get cached leaderboard data
   */
  async getLeaderboard() {
    if (!this.cacheCollection) {
      await this.initialize();
    }

    try {
      const cached = await this.cacheCollection.findOne({ _id: 'leaderboard_cache' });

      if (!cached) {
        return {
          data: [],
          allNodes: [],
          timestamp: null,
          totalNodes: 0,
          message: 'Leaderboard not yet calculated',
          fieldMetadata: this.getFieldMetadata(),
        };
      }

      return {
        data: cached.data, // Top 100 for leaderboard display
        allNodes: cached.allNodes, // Full list for stats calculations
        timestamp: cached.timestamp,
        totalNodes: cached.totalNodes, // Accurate total count
        lastUpdated: cached.timestamp,
        fieldMetadata: this.getFieldMetadata(),
      };
    } catch (error) {
      console.error('❌ Failed to get leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get field metadata with units and descriptions
   */
  getFieldMetadata() {
    return {
      reputationScore: {
        unit: 'points',
        description: 'Overall reputation score (0-100)',
        displayName: 'Reputation',
        decimals: 1,
      },
      activityScore: {
        unit: 'points',
        description: 'Activity coverage (0-10) based on distinct online hours over 7 days',
        displayName: 'Activity',
        decimals: 2,
      },
      uptimeScore: {
        unit: 'points',
        description: 'Longest continuous uptime normalized (0-10)',
        displayName: 'Uptime',
        decimals: 2,
      },
      performanceScore: {
        unit: 'points',
        description: 'Network quality (0-30): throughput + latency',
        displayName: 'Performance',
        decimals: 2,
      },
      stabilityScore: {
        unit: 'points',
        description: 'Consistency (0-10) from hour coverage + recency',
        displayName: 'Stability',
        decimals: 2,
      },
      lastSeen: {
        unit: 'timestamp',
        description: 'Last heartbeat timestamp',
        displayName: 'Last Seen',
      },
      rank: {
        unit: 'position',
        description: 'Current leaderboard rank',
        displayName: 'Rank',
      },
      country: {
        unit: 'text',
        description: 'Device location country',
        displayName: 'Country',
      },
      deviceName: {
        unit: 'text',
        description: 'Device name',
        displayName: 'Device Name',
      },
    };
  }

  /**
   * Force update the leaderboard immediately
   */
  async forceUpdate() {
    console.log('🔄 Force updating leaderboard...');
    await this.updateLeaderboard();
  }
}

// Export singleton instance
const leaderboardService = new LeaderboardService();
module.exports = leaderboardService;
