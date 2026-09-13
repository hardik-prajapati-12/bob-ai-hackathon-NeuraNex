import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Activity, Anchor } from 'lucide-react';
import RiskBadge from '../common/RiskBadge';
import StatusBadge from '../common/StatusBadge';
import BerthGrid from './BerthGrid';
import CraneStatus from './CraneStatus';
import { getTerminalById } from '../../api/terminals';
import { useFetch } from '../../hooks/useFetch';
import { formatPercent, formatTEU } from '../../utils/formatters';
import styles from './TerminalCard.module.css';

function UtilizationBar({ percent, label }) {
  const color =
    percent >= 88 ? 'var(--risk-critical)' :
    percent >= 72 ? 'var(--risk-high)' :
    percent >= 50 ? 'var(--risk-medium)' : 'var(--risk-low)';

  return (
    <div className={styles.utilWrap}>
      <div className={styles.utilLabel}>{label}</div>
      <div className={styles.utilBarBg}>
        <div
          className={styles.utilBarFill}
          style={{ width: `${Math.min(100, percent)}%`, background: color }}
        />
      </div>
      <div className={styles.utilValue} style={{ color }}>{formatPercent(percent)}</div>
    </div>
  );
}

export default function TerminalCard({ terminalId, terminalData: initialData }) {
  const [expanded, setExpanded] = useState(false);

  const { data, loading } = useFetch(
    () => getTerminalById(terminalId),
    [terminalId]
  );

  const terminal = data?.data || initialData;
  const berths = data?.data?.berths || [];
  const cranes = data?.data?.cranes || [];

  const utilPercent = terminal.maxTEUCapacity
    ? Math.round((terminal.currentTEULoad / terminal.maxTEUCapacity) * 100)
    : terminal.utilizationPercent || 0;

  const riskFromUtil =
    utilPercent >= 88 ? 'CRITICAL' :
    utilPercent >= 72 ? 'HIGH' :
    utilPercent >= 50 ? 'MEDIUM' : 'LOW';

  const availableBerths = berths.filter(b => b.currentStatus === 'AVAILABLE').length;
  const occupiedBerths = berths.filter(b => b.currentStatus === 'OCCUPIED').length;
  const maintenanceBerths = berths.filter(b => b.currentStatus === 'MAINTENANCE').length;

  const activeCranes = cranes.filter(c => c.status === 'ACTIVE').length;
  const maintenanceCranes = cranes.filter(c => c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN').length;

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Anchor size={16} color="var(--accent)" />
          <div>
            <div className={styles.terminalName}>{terminal.name}</div>
            <div className={styles.terminalId}>{terminal.terminalId}</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge status={terminal.operationalStatus} />
          <RiskBadge level={riskFromUtil} />
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>TEU Load</span>
          <span className={styles.kpiValue}>
            {formatTEU(terminal.currentTEULoad)} / {formatTEU(terminal.maxTEUCapacity)}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Berths</span>
          <span className={styles.kpiValue}>
            <span style={{ color: 'var(--risk-low)' }}>{availableBerths} free</span>
            {' · '}
            <span style={{ color: 'var(--accent)' }}>{occupiedBerths} occupied</span>
            {maintenanceBerths > 0 && <span style={{ color: 'var(--text-muted)' }}> · {maintenanceBerths} maint.</span>}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Cranes</span>
          <span className={styles.kpiValue}>
            <span style={{ color: 'var(--risk-low)' }}>{activeCranes} active</span>
            {maintenanceCranes > 0 && (
              <span style={{ color: 'var(--risk-high)' }}> · {maintenanceCranes} maint.</span>
            )}
          </span>
        </div>
      </div>

      {/* Utilization bars */}
      <div className={styles.utilSection}>
        <UtilizationBar percent={utilPercent} label="TEU Capacity" />
        <UtilizationBar
          percent={berths.length > 0
            ? Math.round(berths.reduce((s, b) => s + (b.utilizationPercent || 0), 0) / berths.length)
            : 0}
          label="Avg Berth Util."
        />
        <UtilizationBar
          percent={cranes.length > 0
            ? Math.round(cranes.reduce((s, c) => s + (c.utilizationPercent || 0), 0) / cranes.length)
            : 0}
          label="Avg Crane Util."
        />
      </div>

      {/* Expand/collapse berth grid */}
      <button
        className={styles.expandBtn}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Hide' : 'Show'} Berths & Cranes
      </button>

      {expanded && (
        <div className={styles.expandedSection}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '8px' }}>Loading…</div>}
          {berths.length > 0 && <BerthGrid berths={berths} />}
          {cranes.length > 0 && <CraneStatus cranes={cranes} />}
        </div>
      )}
    </div>
  );
}
