import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginBar from './components/LoginBar';
import LotList from './components/LotList';
import LotDetail from './components/LotDetail';
import { createSSEConnection } from './hooks/usePresence';

// --- Generate dummy lots for POC ---
const STATUSES = ['Open', 'In Progress', 'Closed'];
const MAKES = ['Toyota', 'Honda', 'Ford', 'BMW', 'Chevrolet', 'Nissan', 'Dodge', 'Jeep'];
const MODELS = ['Camry', 'Civic', 'F-150', '3 Series', 'Silverado', 'Altima', 'Charger', 'Wrangler'];
const DAMAGES = ['Front End', 'Rear End', 'Side', 'Rollover', 'Flood', 'Fire', 'Hail', 'Mechanical'];
const LOCATIONS = ['Dallas, TX', 'Atlanta, GA', 'Phoenix, AZ', 'Chicago, IL', 'Los Angeles, CA'];

function generateLots(count = 50) {
  return Array.from({ length: count }, (_, i) => {
    const make = MAKES[i % MAKES.length];
    const model = MODELS[i % MODELS.length];
    const year = 2015 + (i % 10);
    return {
      id: String(1000 + i + 1),
      title: `${year} ${make} ${model}`,
      year,
      make,
      model,
      status: STATUSES[i % STATUSES.length],
      price: 3000 + (i * 317) % 20000,
      mileage: 20000 + (i * 1234) % 120000,
      location: LOCATIONS[i % LOCATIONS.length],
      damage: DAMAGES[i % DAMAGES.length],
      vin: `1HGCM82633A${String(100000 + i).padStart(6, '0')}`,
      notes: `Vehicle has ${DAMAGES[i % DAMAGES.length].toLowerCase()} damage. Clean title. Drives and runs. Available for inspection at ${LOCATIONS[i % LOCATIONS.length]}.`
    };
  });
}

const LOTS = generateLots(50);

export default function App() {
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('presenceEmail') ?? '');
  const [presenceMap, setPresenceMap] = useState({});

  const handlePresenceUpdate = useCallback(({ lotId, users }) => {
    setPresenceMap((prev) => ({ ...prev, [String(lotId)]: users }));
  }, []);

  useEffect(() => {
    const es = createSSEConnection(handlePresenceUpdate);
    return () => es.close();
  }, [handlePresenceUpdate]);

  function handleSetEmail(email) {
    if (email) localStorage.setItem('presenceEmail', email);
    else localStorage.removeItem('presenceEmail');
    setUserEmail(email);
  }

  return (
    <div>
      <LoginBar userEmail={userEmail} onSetEmail={handleSetEmail} />

      {!userEmail ? (
        <div style={styles.splash}>
          <div style={styles.splashBox}>
            <h2 style={styles.splashTitle}>Welcome to PresenceHub POC</h2>
            <p style={styles.splashText}>
              Enter your email above to simulate a user.<br />
              Open multiple browser tabs with different emails to see real-time presence in action.
            </p>
          </div>
        </div>
      ) : (
        <div style={styles.page}>
          <Routes>
            <Route
              path="/"
              element={<LotList lots={LOTS} presenceMap={presenceMap} />}
            />
            <Route
              path="/lot/:lotId"
              element={<LotDetail lots={LOTS} userEmail={userEmail} presenceMap={presenceMap} />}
            />
          </Routes>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px 20px'
  },
  splash: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '60vh'
  },
  splashBox: {
    textAlign: 'center',
    padding: '40px',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    maxWidth: '480px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.07)'
  },
  splashTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: '12px'
  },
  splashText: {
    fontSize: '15px',
    color: '#6b7280',
    lineHeight: '1.7'
  }
};
