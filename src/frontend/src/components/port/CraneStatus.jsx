import React from 'react';
import styles from './CraneStatus.module.css';

const TYPE_SHORT = {
  SHIP_TO_SHORE: 'STS',
  RUBBER_TIRED_GANTRY: 'RTG',
  RAIL_MOUNTED_GANTRY: 'RMG',
  MOBILE_HARBOUR: 'MHC',
};

export default function CraneStatus({ cranes }) {
  const statusGroups = cranes.reduce((acc, c) => {
    const s = c.status || 'UNKNOWN';
    if (!acc[s]) acc[s] = [];
    acc[s].push(c);
    return acc;
  }, {});

  const statusOrder = ['ACTIVE', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'];

  return (
    <div>
      <div className={styles.sectionLabel}>Crane Status</div>
      <div className={styles.craneRow}>
        {cranes.map(c => {
          const dotColor =
            c.status === 'ACTIVE' ? 'var(--risk-low)' :
            c.status === 'IDLE' ? 'var(--text-muted)' :
            c.status === 'MAINTENANCE' ? 'var(--risk-medium)' :
            'var(--risk-critical)';

          return (
            <div
              key={c._id}
              className={styles.craneDot}
              title={`${c.name} (${TYPE_SHORT[c.type] || c.type}) — ${c.status} | ${c.liftCapacityTEUPerHour} TEU/h${c.assignedVesselId ? ' | Assigned: ' + (c.assignedVesselId.vesselId || '') : ''}`}
              style={{ borderColor: dotColor, background: `${dotColor}20` }}
            >
              <div className={styles.dotIndicator} style={{ background: dotColor }} />
              <span className={styles.craneLabel}>{TYPE_SHORT[c.type] || '?'}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        {statusOrder.filter(s => statusGroups[s]).map(s => (
          <span key={s} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{
                background:
                  s === 'ACTIVE' ? 'var(--risk-low)' :
                  s === 'IDLE' ? 'var(--text-muted)' :
                  s === 'MAINTENANCE' ? 'var(--risk-medium)' : 'var(--risk-critical)',
              }}
            />
            {statusGroups[s].length} {s.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
