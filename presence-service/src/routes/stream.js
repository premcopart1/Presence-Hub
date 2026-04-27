const express = require('express');
const router = express.Router();
const { subscriber, PRESENCE_CHANNEL, getLotsPresence } = require('../redis/client');
const logger = require('../utils/logger');

// Track all active SSE clients
const clients = new Set();

// Subscribe once to Redis pub/sub and fan out to all SSE clients
subscriber.subscribe(PRESENCE_CHANNEL, (err) => {
  if (err) {
    logger.error('Failed to subscribe to Redis channel', { error: err.message });
  } else {
    logger.info('Subscribed to Redis presence channel');
  }
});

subscriber.on('message', (channel, message) => {
  if (channel === PRESENCE_CHANNEL) {
    clients.forEach((client) => {
      try {
        client.res.write(`event: presence_update\ndata: ${message}\n\n`);
      } catch (err) {
        logger.error('Error writing to SSE client', { error: err.message, clientId: client.id });
      }
    });
  }
});

// GET /presence/stream
router.get('/stream', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 'unknown';

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const clientId = correlationId + '-' + Date.now();
  const client = { id: clientId, res };
  clients.add(client);

  logger.info('SSE client connected', { clientId, correlationId });

  // Send a heartbeat comment every 30s to keep connection alive
  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (_) {}
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(client);
    logger.info('SSE client disconnected', { clientId, correlationId });
  });
});

module.exports = router;
