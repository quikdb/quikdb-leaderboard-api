const mongoose = require('mongoose');

/**
 * Device Heartbeat Schema
 * Stores real-time device metrics and status information
 * READ-ONLY access for leaderboard service
 */
const deviceHeartbeatSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Network metrics
  networkMetrics: {
    speed: {
      type: Number, // Mbps
      required: true
    },
    latency: {
      type: Number, // ms
      required: false
    },
    uploadSpeed: {
      type: Number, // Mbps
      required: false
    },
    downloadSpeed: {
      type: Number, // Mbps
      required: false
    }
  },
  // System resources
  systemResources: {
    cpu: {
      usage: {
        type: Number, // percentage
        required: true
      },
      cores: {
        type: Number,
        required: false
      },
      model: {
        type: String,
        required: false
      }
    },
    memory: {
      total: {
        type: Number, // GB
        required: true
      },
      used: {
        type: Number, // GB
        required: true
      },
      available: {
        type: Number, // GB
        required: true
      }
    },
    storage: {
      total: {
        type: Number, // GB
        required: true
      },
      used: {
        type: Number, // GB
        required: true
      },
      available: {
        type: Number, // GB
        required: true
      }
    }
  },
  // Device status
  status: {
    uptime: {
      type: Number, // seconds
      required: true
    },
    isOnline: {
      type: Boolean,
      default: true
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  // Performance metrics
  performance: {
    requestsPerSecond: {
      type: Number,
      required: false
    },
    responseTime: {
      type: Number, // ms
      required: false
    },
    errorRate: {
      type: Number, // percentage
      required: false
    }
  },
  // Location and connectivity
  location: {
    ip: {
      type: String,
      required: false
    },
    country: {
      type: String,
      required: false
    },
    countryCode: {
      type: String,
      required: false
    },
    region: {
      type: String,
      required: false
    },
    city: {
      type: String,
      required: false
    },
    isp: {
      type: String,
      required: false
    }
  },
  // Network interface details
  networkInterface: {
    interfaceName: {
      type: String,
      required: false
    },
    mac: {
      type: String,
      required: false
    },
    ip: {
      type: String,
      required: false
    },
    externalIp: {
      type: String,
      required: false
    },
    gateway: {
      type: String,
      required: false
    },
    linkState: {
      type: String,
      enum: ['up', 'down', 'unknown'],
      required: false
    }
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
deviceHeartbeatSchema.index({ deviceId: 1, timestamp: -1 });

const DeviceHeartbeat = mongoose.model('DeviceHeartbeat', deviceHeartbeatSchema);

module.exports = DeviceHeartbeat;
