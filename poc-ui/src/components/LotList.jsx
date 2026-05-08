import React, { useEffect, useState } from 'react';
import LotCard from './LotCard';
import { fetchLotsPresence } from '../hooks/usePresence';

const PAGE_SIZE = 12;

export default function LotList({ lots, presenceMap }) {
  const [page, setPage] = useState(1);
  const [initialPresence, setInitialPresence] = useState({});

  const totalPages = Math.ceil(lots.length / PAGE_SIZE);
  const pageLots = lots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageLotIds = pageLots.map((l) => String(l.id));

  // Fetch initial presence for current page
  useEffect(() => {
    fetchLotsPresence(pageLotIds).then(setInitialPresence);
  }, [page]);

  function getUsers(lotId) {
    // Prefer live SSE data, fall back to initial fetch
    return presenceMap?.[String(lotId)] ?? initialPresence?.[String(lotId)] ?? [];
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Lots ({lots.length})</h2>
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button
            style={styles.pageBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {pageLots.map((lot) => (
          <LotCard
            key={lot.id}
            lot={lot}
            users={getUsers(lot.id)}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  heading: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827'
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  pageBtn: {
    padding: '6px 14px',
    background: '#1e40af',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    opacity: 1
  },
  pageInfo: {
    fontSize: '13px',
    color: '#6b7280'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px'
  }
};
