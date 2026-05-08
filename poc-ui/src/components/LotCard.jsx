import React from 'react';
import { useNavigate } from 'react-router-dom';
import LotPresenceBadge from './LotPresenceBadge';

const STATUS_COLORS = {
  Open: { bg: '#dcfce7', text: '#166534' },
  'In Progress': { bg: '#fef9c3', text: '#854d0e' },
  Closed: { bg: '#fee2e2', text: '#991b1b' }
};

export default function LotCard({ lot, users = [] }) {
  const navigate = useNavigate();
  const statusStyle = STATUS_COLORS[lot.status] || STATUS_COLORS['Open'];
  const hasViewers = users.length > 0;

  return (
    <div
      style={{ ...styles.card, ...(hasViewers ? styles.cardActive : {}) }}
      onClick={() => navigate(`/lot/${lot.id}`)}
    >
      <div style={styles.header}>
        <span style={styles.lotId}>Lot #{lot.id}</span>
        <span style={{ ...styles.status, background: statusStyle.bg, color: statusStyle.text }}>
          {lot.status}
        </span>
      </div>
      <div style={styles.title}>{lot.title}</div>
      <div style={styles.meta}>
        <span>{lot.year} {lot.make} {lot.model}</span>
        <span style={styles.price}>${lot.price.toLocaleString()}</span>
      </div>
      <LotPresenceBadge users={users} />
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  cardActive: {
    borderColor: '#bfdbfe',
    boxShadow: '0 1px 3px rgba(59,130,246,0.15)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  lotId: {
    fontWeight: '700',
    fontSize: '15px',
    color: '#1e40af'
  },
  status: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '999px'
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6b7280'
  },
  price: {
    fontWeight: '700',
    color: '#059669'
  }
};
