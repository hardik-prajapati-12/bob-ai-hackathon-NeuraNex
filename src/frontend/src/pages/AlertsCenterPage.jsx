import React, { useState, useCallback } from 'react';
import { Bell, RefreshCw, CheckCircle, AlertTriangle, Info, Filter } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { getAlerts, acknowledgeAlert } from '../api/alerts';
import { useFetch } from '../hooks/useFetch';
import { timeAgo } from '../utils/formatters';
import styles from './AlertsCenterPage.module.css';

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)', label: 'Critical' },
  HIGH:     { color: 'var(--risk-high)',     bg: 'var(--risk-high-bg)',     label: 'High'     },
  WARNING:  { color: 'var(--risk-medium)',   bg: 'var(--risk-medium-bg)',   label: 'Warning'  },
  INFO:     { color: 'var(--risk-low)',      bg: 'var(--risk-low-bg)',      label: 'Info'     },
};

const TYPE_LABELS = {
  CONGESTION_RISK:    'Congestion Risk',
  BERTH_CONFLICT:     'Berth Conflict',
  CRANE_SHORTAGE:     'Crane Shortage',
  VESSEL_DELAY:       'Vessel Delay',
  BERTH_UNAVAILABLE:  'Berth Unavailable',
  CAPACITY_EXCEEDED:  'Capacity Exceeded',
  SCHEDULE_CONFLICT:  'Schedule Conflict',
  MAINTENANCE_ALERT:  'Maintenance Alert',
};

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label.toUpperCase()}
    </span>
  );
}

function SeverityIcon({ severity, size = 16 }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  if (severity === 'INFO') return <Info size={size} color={cfg.color} />;
  return <AlertTriangle size={size} color={cfg.color} />;
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, onAcknowledge, acknowledging }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;

  return (
    <div
      className={styles.alertRow}
      style={{
        borderLeft: `3px solid ${cfg.color}`,
        opacity: alert.acknowledged ? 0.55 : 1,
      }}
    >
      <div className={styles.alertIcon}>
        <SeverityIcon severity={alert.severity} size={18} />
      </div>

      <div className={styles.alertBody}>
        <div className={styles.alertTop}>
          <span className={styles.alertMessage}>{alert.message}</span>
          <SeverityBadge severity={alert.severity} />
        </div>

        <div className={styles.alertMeta}>
          {alert.type && (
            <span className={styles.alertType}>{TYPE_LABELS[alert.type] || alert.type}</span>
          )}
          {alert.terminalCode && (
            <span className={styles.alertTerminal}>Terminal {alert.terminalCode}</span>
          )}
          {alert.vesselCode && (
            <span className={styles.alertVessel}>Vessel {alert.vesselCode}</span>
          )}
          <span className={styles.alertTime}>{timeAgo(alert.createdAt)}</span>
        </div>

        {alert.details && (
          <p className={styles.alertDetails}>{alert.details}</p>
        )}
      </div>

      <div className={styles.alertActions}>
        {alert.acknowledged ? (
          <span className={styles.acknowledgedLabel}>
            <CheckCircle size={13} style={{ marginRight: 4 }} />
            Acknowledged
          </span>
        ) : (
          <button
            className={styles.ackBtn}
            onClick={() => onAcknowledge(alert._id)}
            disabled={acknowledging === alert._id}
          >
            {acknowledging === alert._id ? '...' : 'Acknowledge'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SEVERITY_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'];

export default function AlertsCenterPage() {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const params = {};
  if (severityFilter !== 'ALL') params.severity = severityFilter;
  if (!showAcknowledged) params.acknowledged = false;

  const fetchAlerts = useCallback(
    () => getAlerts({ ...params, limit: 100 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [severityFilter, showAcknowledged, refreshKey]
  );

  const { data, loading, error, refetch } = useFetch(fetchAlerts);

  const alerts = (data?.data || []).slice().sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
      new Date(b.createdAt) - new Date(a.createdAt)
  );

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  async function handleAcknowledge(id) {
    setAcknowledging(id);
    try {
      await acknowledgeAlert(id);
      refetch();
    } catch {
      // error silently — user can retry
    } finally {
      setAcknowledging(null);
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Bell size={20} color="var(--accent)" />
          <h2 className={styles.title}>Alerts Center</h2>
          {unacknowledgedCount > 0 && (
            <span className={styles.badge}>{unacknowledgedCount} active</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-ghost" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.severityFilters}>
          <Filter size={14} color="var(--text-muted)" />
          {SEVERITY_FILTERS.map(s => (
            <button
              key={s}
              className={`${styles.filterChip} ${severityFilter === s ? styles.filterActive : ''}`}
              onClick={() => setSeverityFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={e => setShowAcknowledged(e.target.checked)}
          />
          Show acknowledged
        </label>
      </div>

      {/* Content */}
      {loading && <LoadingSpinner message="Loading alerts..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className={styles.alertList}>
          {alerts.length === 0 ? (
            <div className={styles.empty}>
              <CheckCircle size={36} color="var(--risk-low)" />
              <p>No alerts{severityFilter !== 'ALL' ? ` matching ${severityFilter}` : ''} — all clear.</p>
            </div>
          ) : (
            alerts.map(alert => (
              <AlertRow
                key={alert._id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                acknowledging={acknowledging}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
