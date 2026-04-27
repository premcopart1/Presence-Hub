import React from 'react';
import LotPresenceBanner from './LotPresenceBanner';

const STATUS_COLORS = {
  Open: { bg: '#dcfce7', text: '#166534' },
  'In Progress': { bg: '#fef9c3', text: '#854d0e' },
  Closed: { bg: '#fee2e2', text: '#991b1b' }
};

export default function LotDetail({ lot, userEmail, presenceMap, onBack }) {
  const statusStyle = STATUS_COLORS[lot.status] || STATUS_COLORS['Open'];

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={onBack}>← Back to Lots</button>

      <LotPresenceBanner
        lotId={String(lot.id)}
        userEmail={userEmail}
        presenceMap={presenceMap}
      />

      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>{lot.title}</h1>
            <p style={styles.lotId}>Lot #{lot.id}</p>
          </div>
          <span style={{ ...styles.status, background: statusStyle.bg, color: statusStyle.text }}>
            {lot.status}
          </span>
        </div>

        <div style={styles.details}>
          <Detail label="Year" value={lot.year} />
          <Detail label="Make" value={lot.make} />
          <Detail label="Model" value={lot.model} />
          <Detail label="Price" value={`$${lot.price.toLocaleString()}`} />
          <Detail label="Mileage" value={`${lot.mileage.toLocaleString()} mi`} />
          <Detail label="Location" value={lot.location} />
          <Detail label="Damage" value={lot.damage} />
          <Detail label="VIN" value={lot.vin} />
        </div>

        <div style={styles.description}>
          <h3 style={styles.sectionTitle}>Notes</h3>
          <p style={styles.descText}>{lot.notes}</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  backBtn: {
    marginBottom: '16px',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '7px 14px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '600'
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '28px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f3f4f6'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '4px'
  },
  lotId: {
    fontSize: '14px',
    color: '#6b7280'
  },
  status: {
    fontSize: '13px',
    fontWeight: '600',
    padding: '4px 12px',
    borderRadius: '999px'
  },
  details: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px 24px',
    marginBottom: '24px'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  detailLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#9ca3af',
    fontWeight: '600'
  },
  detailValue: {
    fontSize: '15px',
    color: '#111827',
    fontWeight: '500'
  },
  description: {
    paddingTop: '20px',
    borderTop: '1px solid #f3f4f6'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#374151',
    marginBottom: '8px'
  },
  descText: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6'
  }
};
