import React, { useCallback } from 'react';
import { Ship, AlertTriangle, Anchor, Bell, RefreshCw, Activity, Clock } from 'lucide-react';
import KPICard from '../components/common/KPICard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import RiskBadge from '../components/common/RiskBadge';
import { getDashboardSummary } from '../api/dashboard';
import { getAtRiskVessels } from '../api/vessels';
import { useFetch } from '../hooks/useFetch';
import { riskColor } from '../utils/formatters';
import styles from './DashboardPage.module.css';

// ─── Terminal overview card ───────────────────────────────────────────────────

function TerminalStatusCard({ terminal }) {
  const berthPct = terminal.berthsTotal > 0
    ? Math.round((terminal.berthsOccupied / terminal.berthsTotal) * 100)
    : 0;

  return (
    <div className={styles.terminalCard}>
      <div className={styles.terminalHeader}>
        <span className={styles.terminalName}>{terminal.terminalName}</span>
        <RiskBadge level={terminal.congestionLevel} size="sm" />
      </div>
      <div className={styles.terminalStats}>
        <div className={styles.terminalStat}>
          <span className={styles.terminalStatLabel}>Berths</span>
          <span className={styles.terminalStatValue}>
            {terminal.berthsOccupied}/{terminal.berthsTotal}
          </span>
        </div>
        <div className={styles.terminalStat}>
          <span className={styles.terminalStatLabel}>Queue</span>
          <span className={styles.terminalStatValue}>{terminal.queuedVessels}</span>
        </div>
        <div className={styles.terminalStat}>
          <span className={styles.terminalStatLabel}>Score</span>
          <span
            className={styles.terminalStatValue}
            style={{ color: riskColor(terminal.congestionLevel) }}
          >
            {(terminal.congestionScore * 100).toFixed(0)}
          </span>
        </div>
      </div>
      <div className={styles.berthBar}>
        <div
          className={styles.berthBarFill}
          style={{
            width: `${berthPct}%`,
            background: berthPct > 85
              ? 'var(--risk-critical)'
              : berthPct > 65
              ? 'var(--risk-high)'
              : 'var(--accent)',
          }}
        />
      </div>
      <span className={styles.berthBarLabel}>{berthPct}% occupied</span>
    </div>
  );
}

// ─── At-risk vessel row ───────────────────────────────────────────────────────

function AtRiskVesselRow({ vessel }) {
  return (
    <div className={styles.vesselRow}>
      <div className={styles.vesselInfo}>
        <span className={styles.vesselName}>{vessel.vesselName}</span>
        <span className={styles.vesselMeta}>
          {vessel.vesselId} · {vessel.sizeTEU?.toLocaleString()} TEU
          {vessel.terminalId?.shortName ? ` · ${vessel.terminalId.shortName}` : ''}
        </span>
      </div>
      <div className={styles.vesselRight}>
        {vessel.waitingHours > 0 && (
          <span className={styles.waitHours}>
            <Clock size={11} style={{ marginRight: 3 }} />
            {vessel.waitingHours.toFixed(1)}h wait
          </span>
        )}
        <RiskBadge level={vessel.congestionRisk} size="sm" />
      </div>
    </div>
  );
}

// ─── Vessel status bar ────────────────────────────────────────────────────────

const STATUS_COLORS = {
  AT_BERTH: 'var(--accent)',
  INBOUND:  'var(--risk-medium)',
  WAITING:  'var(--risk-high)',
  DELAYED:  'var(--risk-critical)',
  DEPARTED: 'var(--text-muted)',
};

const STATUS_LABELS = {
  AT_BERTH: 'At Berth',
  INBOUND:  'Inbound',
  WAITING:  'Waiting',
  DELAYED:  'Delayed',
  DEPARTED: 'Departed',
};

function VesselStatusBreakdown({ byStatus }) {
  const entries = Object.entries(STATUS_LABELS)
    .map(([k, label]) => ({ key: k, label, count: byStatus?.[k] || 0 }))
    .filter(e => e.count > 0);

  if (!entries.length) return null;

  return (
    <div className={styles.statusBreakdown}>
      {entries.map(e => (
        <div key={e.key} className={styles.statusBreakdownItem}>
          <span
            className={styles.statusDot}
            style={{ background: STATUS_COLORS[e.key] || 'var(--text-muted)' }}
          />
          <span className={styles.statusBreakdownLabel}>{e.label}</span>
          <span className={styles.statusBreakdownCount}>{e.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const fetchSummary = useCallback(() => getDashboardSummary(), []);
  const fetchAtRisk  = useCallback(() => getAtRiskVessels(),    []);

  const {
    data: summaryRes,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useFetch(fetchSummary);

  const {
    data: atRiskRes,
    loading: atRiskLoading,
  } = useFetch(fetchAtRisk);

  const summary  = summaryRes?.data;
  const atRisk   = atRiskRes?.data || [];
  const loading  = summaryLoading;
  const error    = summaryError;

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error)   return <ErrorMessage message={error} onRetry={refetchSummary} />;

  const congestionColor = riskColor(summary?.congestionLevel);

  return (
    <div className={styles.page}>
      {/* KPI Row */}
      <div className={styles.kpiGrid}>
        <KPICard
          title="Total Vessels"
          value={summary?.totalVessels ?? '—'}
          subtitle="Active in system"
          icon={Ship}
          accentColor="var(--accent)"
        />
        <KPICard
          title="At-Risk Vessels"
          value={summary?.atRiskVessels ?? '—'}
          subtitle="HIGH or CRITICAL risk"
          icon={AlertTriangle}
          accentColor={summary?.atRiskVessels > 0 ? 'var(--risk-high)' : 'var(--risk-low)'}
        />
        <KPICard
          title="Berth Utilization"
          value={summary?.berthUtilization != null ? `${summary.berthUtilization}%` : '—'}
          subtitle="Across all terminals"
          icon={Anchor}
          accentColor={
            summary?.berthUtilization > 85
              ? 'var(--risk-critical)'
              : summary?.berthUtilization > 65
              ? 'var(--risk-high)'
              : 'var(--risk-low)'
          }
        />
        <KPICard
          title="Active Alerts"
          value={summary?.activeAlerts ?? '—'}
          subtitle="Unacknowledged"
          icon={Bell}
          accentColor={summary?.activeAlerts > 0 ? 'var(--risk-medium)' : 'var(--risk-low)'}
        />
      </div>

      {/* Congestion + Vessel Status */}
      <div className={styles.statusRow}>
        <div className="card">
          <div className={styles.sectionHeader}>
            <h3>Port Congestion</h3>
            <RiskBadge level={summary?.congestionLevel || 'UNKNOWN'} size="lg" />
          </div>
          <p className={styles.statusDesc}>
            {summary?.congestionLevel === 'UNKNOWN'
              ? 'Unable to determine congestion level — check analytics engine.'
              : `Overall port congestion score: `}
            {summary?.congestionScore != null && (
              <strong style={{ color: congestionColor }}>
                {(summary.congestionScore * 100).toFixed(1)} / 100
              </strong>
            )}
          </p>
          <div className={styles.systemStatus}>
            <div className={styles.statusItem}>
              <span className={styles.dot} style={{ background: 'var(--risk-low)' }} />
              <span>Backend API</span>
              <span className={styles.statusOk}>Online</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.dot} style={{ background: 'var(--risk-low)' }} />
              <span>Database</span>
              <span className={styles.statusOk}>Connected</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.dot} style={{ background: 'var(--risk-low)' }} />
              <span>Analytics Engine</span>
              <span className={styles.statusOk}>Active</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className={styles.sectionHeader}>
            <h3>Vessel Fleet Status</h3>
            <Activity size={16} color="var(--text-muted)" />
          </div>
          <VesselStatusBreakdown byStatus={summary?.vesselsByStatus} />
        </div>
      </div>

      {/* Terminal Overview */}
      {summary?.terminals?.length > 0 && (
        <div className="card">
          <div className={styles.sectionHeader}>
            <h3>Terminal Overview</h3>
            <span className={styles.sectionMeta}>{summary.terminals.length} terminals</span>
          </div>
          <div className={styles.terminalGrid}>
            {summary.terminals.map(t => (
              <TerminalStatusCard key={t.terminalCode} terminal={t} />
            ))}
          </div>
        </div>
      )}

      {/* At-Risk Vessels */}
      <div className="card">
        <div className={styles.sectionHeader}>
          <h3>At-Risk Vessels</h3>
          <span className={styles.sectionMeta}>
            {atRisk.length} vessel{atRisk.length !== 1 ? 's' : ''} flagged HIGH / CRITICAL
          </span>
        </div>
        {atRiskLoading ? (
          <LoadingSpinner message="Loading vessels..." />
        ) : atRisk.length === 0 ? (
          <p className={styles.emptyMsg}>No at-risk vessels — fleet is operating normally.</p>
        ) : (
          <div className={styles.vesselList}>
            {atRisk.slice(0, 10).map(v => (
              <AtRiskVesselRow key={v._id} vessel={v} />
            ))}
            {atRisk.length > 10 && (
              <p className={styles.moreMsg}>+{atRisk.length - 10} more — see Vessel Management</p>
            )}
          </div>
        )}
      </div>

      {/* Refresh hint */}
      <div className={styles.refreshHint}>
        <RefreshCw size={12} />
        <span>Live data — navigate away and back to refresh, or use page refresh</span>
      </div>
    </div>
  );
}
