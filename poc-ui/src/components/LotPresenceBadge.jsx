import React from 'react';

/**
 * LotPresenceBadge — shown on home page next to each lot
 * @param {Array} users - array of { userEmail } objects
 */
export default function LotPresenceBadge({ users = [] }) {
  if (users.length === 0) return null;

  const displayLimit = 3;
  const visible = users.slice(0, displayLimit);
  const overflow = users.length - displayLimit;

  return (
    <div style={styles.container} title={users.map((u) => u.userEmail).join(', ')}>
      {visible.map((u, i) => (
        <Avatar key={i} email={u.userEmail} index={i} />
      ))}
      {overflow > 0 && (
        <div style={{ ...styles.avatar, ...styles.overflow }}>+{overflow}</div>
      )}
      <span style={styles.label}>
        {users.length === 1 ? '1 viewing' : `${users.length} viewing`}
      </span>
    </div>
  );
}

function Avatar({ email, index }) {
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626'];
  const bg = colors[index % colors.length];

  return (
    <div style={{ ...styles.avatar, background: bg }} title={email}>
      {initials}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '6px'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: '700',
    color: '#fff',
    border: '2px solid #fff',
    marginLeft: '-4px',
    flexShrink: 0
  },
  overflow: {
    background: '#6b7280',
    fontSize: '8px'
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
    marginLeft: '6px',
    whiteSpace: 'nowrap'
  }
};
