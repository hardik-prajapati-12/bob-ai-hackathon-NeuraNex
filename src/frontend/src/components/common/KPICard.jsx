import React from 'react';
import styles from './KPICard.module.css';

/**
 * KPICard — displays a key metric with optional trend indicator.
 */
export default function KPICard({ title, value, subtitle, trend, icon: Icon, accentColor }) {
  const trendColor =
    trend > 0 ? 'var(--risk-high)' : trend < 0 ? 'var(--risk-low)' : 'var(--text-muted)';

  return (
    <div className={styles.card} style={accentColor ? { borderLeftColor: accentColor } : {}}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {Icon && (
          <div className={styles.iconWrap} style={accentColor ? { color: accentColor } : {}}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className={styles.value}>{value ?? '—'}</div>
      {(subtitle || trend !== undefined) && (
        <div className={styles.footer}>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          {trend !== undefined && (
            <span style={{ color: trendColor, fontSize: '0.75rem', fontWeight: 600 }}>
              {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : 'Stable'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
