import React, { useEffect, useState } from 'react';
import { X, Ship, Anchor, Activity } from 'lucide-react';
import RiskBadge from '../common/RiskBadge';
import StatusBadge from '../common/StatusBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import { getVesselById } from '../../api/vessels';
import { getSchedulesByVessel } from '../../api/schedules';
import { formatDate, formatTEU } from '../../utils/formatters';
import styles from './VesselDetailPanel.module.css';

function DetailRow({ label, value, mono }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={`${styles.detailValue} ${mono ? styles.mono : ''}`}>{value || '—'}</span>
    </div>
  );
}

export default function VesselDetailPanel({ vessel: initial, onClose }) {
  const [vessel, setVessel] = useState(initial);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reload full vessel detail when the selected vessel changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getVesselById(initial.vesselId),
      getSchedulesByVessel(initial.vesselId),
    ])
      .then(([vRes, sRes]) => {
        if (!cancelled) {
          setVessel(vRes.data || initial);
          setSchedules(sRes.data || []);
        }
      })
      .catch(() => {
        // keep initial vessel data on error
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [initial.vesselId]);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <Ship size={16} color="var(--accent)" />
          <h3>{vessel.vesselName}</h3>
        </div>
        <button className="btn btn-ghost" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </div>

      {loading && <LoadingSpinner size={20} message="" />}

      <div className={styles.panelBody}>
        {/* Risk + status header */}
        <div className={styles.badges}>
          <StatusBadge status={vessel.status} size="lg" />
          <RiskBadge level={vessel.congestionRisk} size="lg" />
          {vessel.priority === 'HIGH' && (
            <span className={styles.highPriority}>HIGH PRIORITY</span>
          )}
        </div>

        {/* Identification */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Identification</div>
          <DetailRow label="Vessel ID" value={vessel.vesselId} />
          <DetailRow label="IMO Number" value={vessel.imoNumber} />
          <DetailRow label="Type" value={vessel.vesselType} />
          <DetailRow label="Shipping Line" value={vessel.shippingLine} />
          <DetailRow label="Flag" value={vessel.flag} />
          <DetailRow label="Cargo Type" value={vessel.cargoType} />
        </div>

        {/* Capacity */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Capacity</div>
          <DetailRow label="TEU Capacity" value={formatTEU(vessel.sizeTEU)} />
          <DetailRow label="Length" value={vessel.lengthOverallM ? `${vessel.lengthOverallM}m` : null} />
          <DetailRow label="Max Draft" value={vessel.maxDraftM ? `${vessel.maxDraftM}m` : null} />
          <DetailRow label="Required Cranes" value={vessel.requiredCranes} />
        </div>

        {/* Scheduling */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Scheduling</div>
          <DetailRow label="ETA" value={formatDate(vessel.arrivalTime)} mono />
          <DetailRow label="ETD" value={formatDate(vessel.estimatedDeparture)} mono />
          {vessel.actualArrival && (
            <DetailRow label="Actual Arrival" value={formatDate(vessel.actualArrival)} mono />
          )}
          <DetailRow label="Est. Processing" value={vessel.estimatedProcessingHours ? `${vessel.estimatedProcessingHours}h` : null} />
        </div>

        {/* Assignment */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Assignment</div>
          <DetailRow
            label="Terminal"
            value={vessel.terminalId?.name || vessel.terminalCode || null}
          />
          <DetailRow
            label="Berth"
            value={vessel.assignedBerthId?.name || null}
          />
          {vessel.waitingHours > 0 && (
            <DetailRow label="Waiting" value={`${vessel.waitingHours.toFixed(1)} hours`} />
          )}
        </div>

        {/* Cranes assigned */}
        {vessel.assignedCraneIds?.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Assigned Cranes</div>
            {vessel.assignedCraneIds.map(c => (
              <div key={c._id || c} className={styles.craneRow}>
                <Activity size={11} color="var(--accent)" />
                <span>{c.name || c.craneId || '—'}</span>
                {c.type && <span className={styles.craneType}>{c.type.replace(/_/g, ' ')}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Risk */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Congestion Risk</div>
          <div className={styles.riskScore}>
            <RiskBadge level={vessel.congestionRisk} size="lg" />
            <span className={styles.scoreNum}>
              Score: {vessel.congestionRiskScore?.toFixed(2) ?? '—'}
            </span>
          </div>
        </div>

        {/* Recent schedule */}
        {schedules.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Schedule</div>
            {schedules.slice(0, 2).map(s => (
              <div key={s._id} className={styles.scheduleItem}>
                <div className={styles.scheduleId}>{s.scheduleId}</div>
                <div className={styles.scheduleMeta}>
                  <StatusBadge status={s.status} />
                  {s.berthId && (
                    <span className={styles.scheduleDetail}> Berth: {s.berthId.name || s.berthCode}</span>
                  )}
                  {s.delayHours > 0 && (
                    <span style={{ color: 'var(--risk-high)', fontSize: '0.75rem' }}>
                      {' '}+{s.delayHours}h delay
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
