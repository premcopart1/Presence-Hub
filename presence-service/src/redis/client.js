const Redis = require('ioredis');
const logger = require('../utils/logger');

const STALE_TIMEOUT_MS = parseInt(process.env.STALE_TIMEOUT_MS) || 900000; // 15 min

// Two clients — one for commands, one for pub/sub
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
});

const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
});

redis.on('connect', () => logger.info('Redis client connected'));
redis.on('error', (err) => logger.error('Redis client error', { error: err.message }));
subscriber.on('connect', () => logger.info('Redis subscriber connected'));
subscriber.on('error', (err) => logger.error('Redis subscriber error', { error: err.message }));

const PRESENCE_CHANNEL = 'presence:updates';

// Enter a lot
async function enterLot(lotId, userEmail, correlationId) {
  const key = `presence:lot:${lotId}`;
  const value = JSON.stringify({ userEmail, lastSeen: Date.now(), correlationId });
  await redis.hset(key, correlationId, value);
  const users = await getLotUsers(lotId);
  await redis.publish(PRESENCE_CHANNEL, JSON.stringify({ lotId, users }));
  logger.info('User entered lot', { userEmail, lotId, correlationId });
}

// Leave a lot
async function leaveLot(lotId, userEmail, correlationId) {
  const key = `presence:lot:${lotId}`;
  await redis.hdel(key, correlationId);
  const users = await getLotUsers(lotId);
  await redis.publish(PRESENCE_CHANNEL, JSON.stringify({ lotId, users }));
  logger.info('User left lot', { userEmail, lotId, correlationId });
}

// Heartbeat — update lastSeen
async function heartbeat(lotId, userEmail, correlationId) {
  const key = `presence:lot:${lotId}`;
  const existing = await redis.hget(key, correlationId);
  if (existing) {
    const value = JSON.stringify({ userEmail, lastSeen: Date.now(), correlationId });
    await redis.hset(key, correlationId, value);
    logger.debug('Heartbeat received', { userEmail, lotId, correlationId });
  } else {
    // Session not found — treat as re-enter
    await enterLot(lotId, userEmail, correlationId);
  }
}

// Get all active users on a lot
async function getLotUsers(lotId) {
  const key = `presence:lot:${lotId}`;
  const entries = await redis.hgetall(key);
  if (!entries) return [];
  return Object.values(entries).map((v) => JSON.parse(v));
}

// Batch fetch presence for multiple lots
async function getLotsPresence(lotIds) {
  const result = {};
  await Promise.all(
    lotIds.map(async (lotId) => {
      result[lotId] = await getLotUsers(lotId);
    })
  );
  return result;
}

// Stale session cleanup — called by scheduled job
async function cleanupStaleSessions() {
  const now = Date.now();
  const keys = await redis.keys('presence:lot:*');
  let cleaned = 0;

  for (const key of keys) {
    const entries = await redis.hgetall(key);
    if (!entries) continue;

    for (const [correlationId, raw] of Object.entries(entries)) {
      const entry = JSON.parse(raw);
      const age = now - entry.lastSeen;
      if (age > STALE_TIMEOUT_MS) {
        await redis.hdel(key, correlationId);
        const lotId = key.replace('presence:lot:', '');
        const users = await getLotUsers(lotId);
        await redis.publish(PRESENCE_CHANNEL, JSON.stringify({ lotId, users }));
        logger.info('Stale session cleaned up', {
          userEmail: entry.userEmail,
          lotId,
          correlationId,
          staleSinceMs: age
        });
        cleaned++;
      }
    }
  }

  if (cleaned > 0) logger.info(`Cleanup complete`, { sessionsRemoved: cleaned });
}

// Remove all lot entries for a correlationId — called on SSE disconnect
async function leaveByCorrelationId(correlationId) {
  const keys = await redis.keys('presence:lot:*');
  for (const key of keys) {
    const raw = await redis.hget(key, correlationId);
    if (!raw) continue;
    const entry = JSON.parse(raw);
    await redis.hdel(key, correlationId);
    const lotId = key.replace('presence:lot:', '');
    const users = await getLotUsers(lotId);
    await redis.publish(PRESENCE_CHANNEL, JSON.stringify({ lotId, users }));
    logger.info('User left lot via SSE disconnect', { userEmail: entry.userEmail, lotId, correlationId });
  }
}

module.exports = {
  redis,
  subscriber,
  PRESENCE_CHANNEL,
  enterLot,
  leaveLot,
  leaveByCorrelationId,
  heartbeat,
  getLotUsers,
  getLotsPresence,
  cleanupStaleSessions
};
