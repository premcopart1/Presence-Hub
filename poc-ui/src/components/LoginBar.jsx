import React, { useState } from 'react';

export default function LoginBar({ userEmail, onSetEmail }) {
  const [input, setInput] = useState(userEmail || '');

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) onSetEmail(input.trim());
  }

  return (
    <div style={styles.bar}>
      <span style={styles.logo}>PresenceHub POC</span>
      {userEmail ? (
        <div style={styles.userInfo}>
          <div style={styles.avatar}>{userEmail.slice(0, 2).toUpperCase()}</div>
          <span style={styles.email}>{userEmail}</span>
          <button style={styles.switchBtn} onClick={() => onSetEmail('')}>
            Switch User
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Enter your email to simulate a user..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button style={styles.btn} type="submit">Start</button>
        </form>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1e40af',
    color: '#fff',
    padding: '12px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  logo: {
    fontWeight: '700',
    fontSize: '18px',
    letterSpacing: '-0.5px'
  },
  form: {
    display: 'flex',
    gap: '8px'
  },
  input: {
    padding: '7px 12px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    width: '280px',
    outline: 'none'
  },
  btn: {
    padding: '7px 16px',
    background: '#f59e0b',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '14px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#f59e0b',
    color: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '12px'
  },
  email: {
    fontSize: '14px'
  },
  switchBtn: {
    padding: '4px 10px',
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
};
