import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ErrorMessage — displays an API or runtime error to the user.
 */
export default function ErrorMessage({ message = 'Something went wrong.', onRetry }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        gap: '12px',
        color: 'var(--risk-high)',
      }}
    >
      <AlertTriangle size={32} />
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
        {message}
      </p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
