import React from 'react';
import { statusColor } from '../../utils/formatters';

const LABELS = {
  AT_BERTH: 'At Berth',
  INBOUND: 'Inbound',
  WAITING: 'Waiting',
  DELAYED: 'Delayed',
  DEPARTED: 'Departed',
  DIVERTED: 'Diverted',
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Maintenance',
  RESERVED: 'Reserved',
  ACTIVE: 'Active',
  IDLE: 'Idle',
  BREAKDOWN: 'Breakdown',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status, size = 'sm' }) {
  const color = statusColor(status);
  const label = LABELS[status?.toUpperCase()] || status || '—';
  const fs = size === 'lg' ? '0.8rem' : '0.7rem';
  const pad = size === 'lg' ? '4px 10px' : '2px 8px';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: pad,
        borderRadius: '4px',
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background: `${color}18`,
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
