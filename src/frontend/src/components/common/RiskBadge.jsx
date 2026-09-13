import React from 'react';

const RISK_CONFIG = {
  LOW: { label: 'LOW', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' },
  MEDIUM: { label: 'MEDIUM', color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
  HIGH: { label: 'HIGH', color: 'var(--risk-high)', bg: 'var(--risk-high-bg)' },
  CRITICAL: { label: 'CRITICAL', color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' },
  UNKNOWN: { label: 'UNKNOWN', color: 'var(--text-muted)', bg: 'transparent' },
};

/**
 * RiskBadge — displays a colored risk level badge.
 * Risk level must be: LOW | MEDIUM | HIGH | CRITICAL
 */
export default function RiskBadge({ level, size = 'sm' }) {
  const cfg = RISK_CONFIG[level?.toUpperCase()] || RISK_CONFIG.UNKNOWN;
  const fontSize = size === 'lg' ? '0.8rem' : '0.7rem';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: size === 'lg' ? '4px 10px' : '2px 8px',
        borderRadius: '4px',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}
