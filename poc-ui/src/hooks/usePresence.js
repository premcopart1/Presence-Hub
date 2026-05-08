import { useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const PRESENCE_URL = import.meta.env.VITE_PRESENCE_SERVICE_URL || 'http://localhost:4000';
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// One correlationId per tab (persisted for the tab's lifetime)
const CORRELATION_ID = uuidv4();

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Correlation-ID': CORRELATION_ID
  };
}

async function postPresence(endpoint, body) {
  try {
    await fetch(`${PRESENCE_URL}/presence/${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  } catch (_) {
    // Silently fail — presence is best-effort
  }
}

/**
 * usePresence — call this on a lot detail page
 * @param {string} lotId - the lot being viewed
 * @param {string} userEmail - the current user's email
 */
export function usePresence(lotId, userEmail) {
  const heartbeatRef = useRef(null);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      postPresence('heartbeat', { lotId, userEmail });
    }, HEARTBEAT_INTERVAL_MS);
  }, [lotId, userEmail]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!lotId || !userEmail) return;

    // Enter lot + start heartbeat
    postPresence('enter', { lotId, userEmail });
    startHeartbeat();

    // Page visibility — stop heartbeat when tab hidden, resume when visible
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopHeartbeat();
      } else {
        postPresence('enter', { lotId, userEmail });
        startHeartbeat();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Graceful leave on component unmount (navigation)
      stopHeartbeat();
      postPresence('leave', { lotId, userEmail });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lotId, userEmail, startHeartbeat, stopHeartbeat]);
}

/**
 * createSSEConnection — call once at app level
 * Returns an EventSource. Caller is responsible for closing it.
 * @param {function} onUpdate - called with { lotId, users } on each presence_update event
 */
export function createSSEConnection(onUpdate) {
  const url = `${PRESENCE_URL}/presence/stream?correlationId=${CORRELATION_ID}`;
  const es = new EventSource(url);

  es.addEventListener('presence_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      onUpdate(data);
    } catch (_) {}
  });

  es.onerror = () => {
    // Browser auto-reconnects EventSource — no action needed
  };

  return es;
}

/**
 * fetchLotsPresence — fetch initial presence for a list of lot IDs
 * @param {string[]} lotIds
 * @returns {Promise<Object>} { [lotId]: [{ userEmail, lastSeen, correlationId }] }
 */
export async function fetchLotsPresence(lotIds) {
  if (!lotIds || lotIds.length === 0) return {};
  try {
    const res = await fetch(
      `${PRESENCE_URL}/presence/lots?lotIds=${lotIds.join(',')}`,
      { headers: getHeaders() }
    );
    const data = await res.json();
    return data.presence || {};
  } catch (_) {
    return {};
  }
}

/**
 * fetchLotPresence — fetch presence for a single lot
 * @param {string} lotId
 * @returns {Promise<Array>}
 */
export async function fetchLotPresence(lotId) {
  try {
    const res = await fetch(
      `${PRESENCE_URL}/presence/lot/${lotId}`,
      { headers: getHeaders() }
    );
    const data = await res.json();
    return data.users || [];
  } catch (_) {
    return [];
  }
}
