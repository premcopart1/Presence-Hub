require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { cleanupStaleSessions } = require('./redis/client');
const presenceRoutes = require('./routes/presence');
const streamRoutes = require('./routes/stream');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS) || 300000; // 5 min

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/presence', presenceRoutes);
app.use('/presence', streamRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'unknown';
  logger.error('Unhandled error', { error: err.message, stack: err.stack, correlationId });
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  // Stale session cleanup job
  setInterval(async () => {
    logger.debug('Running stale session cleanup');
    await cleanupStaleSessions();
  }, CLEANUP_INTERVAL_MS);

  app.listen(PORT, () => {
    logger.info(`PresenceHub service started`, { port: PORT });
  });
}

start();
