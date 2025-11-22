# QuikDB Leaderboard API

Standalone microservice for QuikDB node reputation rankings and leaderboard data.

## Overview

The Leaderboard API provides **read-only** access to node reputation scores, rankings, and statistics. It operates independently from the main Device API while sharing the same MongoDB database.

## Features

- ✅ **Public API** - No authentication required
- 📊 **Real-time Rankings** - Updated every 60 seconds
- 🚀 **High Performance** - Cached data with rate limiting
- 🔒 **Read-Only** - No write access to database
- 🐳 **Docker Ready** - Containerized deployment
- 📈 **Metrics & Health** - Built-in monitoring endpoints

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB connection (shared with Device API)
- Yarn package manager

### Installation

```bash
# Install dependencies
yarn install

# Copy environment template
cp .env.example .env

# Configure environment variables
nano .env
```

### Development

```bash
# Start in development mode with auto-reload
yarn dev

# Start in production mode
yarn start
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✅ | - | MongoDB connection string |
| `PORT` | | `3001` | Server port |
| `NODE_ENV` | | `development` | Environment mode |
| `CORS_ALLOWED_ORIGINS` | | See .env.example | Comma-separated allowed origins |
| `RATE_LIMIT_MAX` | | `200` | Max requests per minute |
| `LEADERBOARD_UPDATE_INTERVAL_MS` | | `60000` | Cache refresh interval (ms) |

## API Endpoints

### Root

```http
GET /
```

Returns API information and available endpoints.

### Health Check

```http
GET /health
```

Returns service health status and database connectivity.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-22T10:30:00.000Z",
  "services": {
    "database": "connected",
    "leaderboard": "healthy"
  },
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

### Metrics

```http
GET /metrics
```

Returns system metrics (memory, uptime).

### Full Leaderboard

```http
GET /leaderboard
```

Returns top 100 nodes with full rankings and scores.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "nodeId": "device-123",
      "reputationScore": 95.5,
      "status": "excellent",
      "rankBadge": "🏆 Excellent",
      ...
    }
  ],
  "metadata": {
    "totalNodes": 450,
    "lastUpdated": "2025-11-22T10:30:00.000Z"
  }
}
```

### Node Ranking

```http
GET /leaderboard/node/:nodeId
```

Returns specific node's ranking and detailed stats.

**Parameters:**

- `nodeId` (path) - Device ID to lookup

### Top N Nodes

```http
GET /leaderboard/top/:count
```

Returns top N nodes (max 100).

**Parameters:**

- `count` (path) - Number of nodes to return (1-100)

### Statistics

```http
GET /leaderboard/stats
```

Returns aggregated leaderboard statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalNodes": 450,
    "averageScore": 72.5,
    "topScore": 98.5,
    "lastUpdated": "2025-11-22T10:30:00.000Z",
    "scoreDistribution": {
      "excellent": 120,
      "good": 180,
      "average": 100,
      "poor": 50
    }
  }
}
```

### Force Refresh

```http
POST /leaderboard/refresh
```

Triggers immediate leaderboard recalculation.

⚠️ **Note:** Should be protected with admin authentication in production.

## Architecture

### Database Access

- **READ-ONLY** access to `device_heartbeats` collection
- **READ-WRITE** access to `leaderboard_cache` collection
- Shares MongoDB connection with Device API

### Caching Strategy

- Leaderboard calculated every 60 seconds (configurable)
- Results cached in `leaderboard_cache` collection
- Top 100 nodes returned by default
- Full node list available for stats calculations

### Performance

- Rate limiting: 200 requests/minute (configurable)
- Cache size monitoring with BSON limit warnings
- Graceful shutdown with cleanup

## Deployment

### Docker

```bash
# Build image
docker build -t quikdb-leaderboard-api .

# Run container
docker run -d \
  --name leaderboard-api \
  -p 3001:3001 \
  -e MONGODB_URI="mongodb://..." \
  quikdb-leaderboard-api
```

### Kubernetes

See `k8s/` directory for deployment manifests.

### Environment-Specific Setup

**Production:**

```bash
NODE_ENV=production yarn start
```

**Development:**

```bash
yarn dev
```

## Monitoring

### Health Checks

```bash
# Check service health
curl http://localhost:3001/health

# Check metrics
curl http://localhost:3001/metrics
```

### Logs

All logs include timestamps and severity levels:

- 🚀 Startup/shutdown events
- 🔄 Cache updates
- ❌ Errors
- 📊 Request logging with duration

## Security

- Helmet.js for security headers
- CORS with configurable origins
- Rate limiting per endpoint
- No authentication required (public API)
- Read-only database access

## Troubleshooting

### Database Connection Issues

```
❌ Failed to connect to MongoDB
```

- Verify `MONGODB_URI` is correct
- Check network connectivity
- Ensure MongoDB is running

### Cache Size Warnings

```
⚠️ Leaderboard cache size: 12.5MB (approaching 16MB BSON limit)
```

- Normal with large node counts
- Consider splitting cache if > 12MB
- Monitor node count growth

### Rate Limiting

```
429 Too Many Requests
```

- Default: 200 req/min
- Increase `RATE_LIMIT_MAX` if needed
- Implement client-side caching

## Development

### Project Structure

```
quikdb-leaderboard-api/
├── src/
│   ├── app.js              # Main application
│   ├── models/
│   │   └── deviceHeartbeat.js
│   ├── services/
│   │   └── leaderboard.js
│   └── routes/
│       └── leaderboard.js
├── package.json
├── .env.example
├── Dockerfile
└── README.md
```

### Testing

```bash
# Start development server
yarn dev

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/leaderboard
curl http://localhost:3001/leaderboard/stats
```

## License

MIT

## Support

For issues or questions, contact the QuikDB team.
# quikdb-leaderboard-api
