const express = require('express');
const router = express.Router();
const { enterLot, leaveLot, heartbeat, getLotUsers, getLotsPresence } = require('../redis/client');
const logger = require('../utils/logger');

function getCorrelationId(req) {
  return req.headers['x-correlation-id'] || 'unknown';
}

// POST /presence/enter
router.post('/enter', async (req, res) => {
  const { lotId, userEmail } = req.body;
  const correlationId = getCorrelationId(req);

  if (!lotId || !userEmail) {
    return res.status(400).json({ error: 'lotId and userEmail are required' });
  }

  try {
    await enterLot(lotId, userEmail, correlationId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error in /enter', { error: err.message, correlationId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /presence/leave
router.post('/leave', async (req, res) => {
  const { lotId, userEmail } = req.body;
  const correlationId = getCorrelationId(req);

  if (!lotId || !userEmail) {
    return res.status(400).json({ error: 'lotId and userEmail are required' });
  }

  try {
    await leaveLot(lotId, userEmail, correlationId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error in /leave', { error: err.message, correlationId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /presence/heartbeat
router.post('/heartbeat', async (req, res) => {
  const { lotId, userEmail } = req.body;
  const correlationId = getCorrelationId(req);

  if (!lotId || !userEmail) {
    return res.status(400).json({ error: 'lotId and userEmail are required' });
  }

  try {
    await heartbeat(lotId, userEmail, correlationId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error in /heartbeat', { error: err.message, correlationId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /presence/lot/:lotId
router.get('/lot/:lotId', async (req, res) => {
  const { lotId } = req.params;
  const correlationId = getCorrelationId(req);

  try {
    const users = await getLotUsers(lotId);
    res.json({ lotId, users });
  } catch (err) {
    logger.error('Error in /lot/:lotId', { error: err.message, correlationId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /presence/lots?lotIds=1,2,3
router.get('/lots', async (req, res) => {
  const correlationId = getCorrelationId(req);
  const { lotIds } = req.query;

  if (!lotIds) {
    return res.status(400).json({ error: 'lotIds query param is required' });
  }

  const ids = lotIds.split(',').map((id) => id.trim()).filter(Boolean);

  try {
    const presence = await getLotsPresence(ids);
    res.json({ presence });
  } catch (err) {
    logger.error('Error in /lots', { error: err.message, correlationId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
