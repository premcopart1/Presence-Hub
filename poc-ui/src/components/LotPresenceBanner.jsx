import React, { useEffect, useState } from 'react';
import { usePresence, fetchLotPresence } from '../hooks/usePresence';

/**
 * LotPresenceBanner — shown on lot detail page
 * Registers presence and shows who else is viewing
 * @param {string} lotId
 * @param {string} userEmail - current user
 * @param {Object} presenceMap - live presence map from App-level SSE { [lotId]: users[] }
 */
export default function LotPresenceBanner({ lotId, userEmail, presenceMap }) {
  const [initialUsers, setInitialUsers] = useState([]);

  // Register presence for this lot
  usePresence(lotId, userEmail);

  // Fetch initial presence on mount
  useEffect(() => {
    if (!lotId) return;
    fetchLotPresence(lotId).then(setInitialUsers);
  }, [lotId]);

  // Use live SSE data if available, else fall back to initial fetch
  const allUsers = presenceMap?.[lotId] ?? initialUsers;
  const others = allUsers.filter((u) => u.userEmail !== userEmail);

  if (others.length === 0) return null;

  return (
    <div style={styles.banner}>
      <span style={styles.icon}>👥</span>
      <span style={styles.text}>
        <strong>Also viewing: </strong>
        {others.map((u) => u.userEmail).join(', ')}
      </span>
    </div>
  );
}

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '10px 16px',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#1e40af'
  },
  icon: {
    fontSize: '18px'
  },
  text: {
    lineHeight: '1.4'
  }
};
