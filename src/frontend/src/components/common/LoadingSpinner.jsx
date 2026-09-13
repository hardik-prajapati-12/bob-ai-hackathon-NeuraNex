import React from 'react';

/**
 * LoadingSpinner — centered spinner for data loading states.
 */
export default function LoadingSpinner({ size = 24, message = 'Loading...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        gap: '12px',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      {message && <span>{message}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
