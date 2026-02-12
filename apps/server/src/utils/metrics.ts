import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeWebSocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const boardEventCounter = new client.Counter({
  name: 'board_events_total',
  help: 'Total number of board events',
  labelNames: ['event_type'],
  registers: [register],
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  registers: [register],
});
