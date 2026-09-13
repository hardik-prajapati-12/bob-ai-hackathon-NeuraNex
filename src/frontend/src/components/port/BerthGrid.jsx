import React from 'react';
import StatusBadge from '../common/StatusBadge';
import { formatTEU, formatDateShort } from '../../utils/formatters';
import styles from './BerthGrid.module.css';

const STATUS_PRIORITY = { OCCUPIED: 0, RESERVED: 1, AVAILABLE: 2, MAINTENANCE: 3 };

export default function BerthGrid({ berths }) {
  const sorted = [...berths].sort(
    (a, b) => (STATUS_PRIORITY[a.currentStatus] ?? 9) - (STATUS_PRIORITY[b.currentStatus] ?? 9)
  );

  return (
    <div>
      <div className={styles.sectionLabel}>Berth Status</div>
      <div className={styles.grid}>
        {sorted.map(b => (
          <div
            key={b._id}
            className={`${styles.berthCell} ${styles[b.currentStatus?.toLowerCase()]}`}
            title={b.assignedVesselId ? `${b.assignedVesselId.vesselName} — ${formatTEU(b.assignedVesselId.sizeTEU)}` : b.name}
          >
            <div className={styles.berthId}>{b.name}</div>
            <div className={styles.berthCapacity}>{formatTEU(b.maxVesselSizeTEU)}</div>
            {b.currentStatus === 'OCCUPIED' && b.assignedVesselId && (
              <div className={styles.vesselName}>{b.assignedVesselId.vesselName}</div>
            )}
            {b.currentStatus === 'OCCUPIED' && b.availableFrom && (
              <div className={styles.availFrom}>Free {formatDateShort(b.availableFrom)}</div>
            )}
            {b.currentStatus === 'AVAILABLE' && (
              <div className={styles.availTag}>OPEN</div>
            )}
            {b.currentStatus === 'MAINTENANCE' && (
              <div className={styles.maintTag}>MAINT.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
