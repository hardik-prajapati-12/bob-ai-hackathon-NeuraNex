import React, { useState, useCallback } from 'react';
import {
  Settings2,
  RefreshCw,
  Anchor,
  Cpu,
  Ship,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import {
  runOptimize,
} from '../api/optimization';
import { useFetch } from '../hooks/useFetch';
import { riskColor, formatTEU, formatDateShort } from '../utils/formatters';
import styles from './OptimizationCenterPage.module.css';

const TERMINALS = ['ALL', 'T1', 'T2', 'T3'];

// ── Severity color mapping ────────────────────────────────────────────────────
const SEVERITY_COLORS = {
  CRITICAL: 'var(--risk-critical)',
  HIGH: 'var(--risk-high)',
  MEDIUM: 'var(--risk-medium)',
  LOW: 'var(--risk-low)',
};

const SEVERITY_BG = {
  CRITICAL: 'var(--risk-critical-bg)',
  HIGH: 'var(--risk-high-bg)',
  MEDIUM: 'var(--risk-medium-bg)',
  LOW: 'var(--risk-low-bg)',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct > 70 ? 'var(--risk-low)' : pct > 40 ? 'var(--risk-medium)' : 'var(--risk-high)';
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.scoreLabel} style={{ color }}>{pct}</span>
    </div>
  );
}

function SummaryBanner({ summary }) {
  if (!summary) return null;
  const r = summary.resourceUtilization;
  const items = [
    { label: 'Available Berths', value: r.availableBerths, color: 'var(--risk-low)' },
    { label: 'Occupied Berths', value: r.occupiedBerths, color: 'var(--accent)' },
    { label: 'Active Cranes', value: r.activeCranes, color: 'var(--risk-low)' },
    { label: 'Inactive Cranes', value: r.inactiveCranes, color: 'var(--risk-high)' },
    { label: 'Waiting Vessels', value: r.waitingVessels, color: r.waitingVessels > 3 ? 'var(--risk-critical)' : 'var(--risk-medium)' },
    { label: 'Conflicts', value: summary.conflictsDetected, color: summary.conflictsDetected > 2 ? 'var(--risk-critical)' : 'var(--risk-medium)' },
  ];
  return (
    <div className={styles.summaryBanner}>
      {items.map(({ label, value, color }) => (
        <div key={label} className={styles.summaryCard}>
          <div className={styles.summaryValue} style={{ color }}>{value ?? '—'}</div>
          <div className={styles.summaryLabel}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Berth recommendations table ───────────────────────────────────────────────
function BerthRecsTable({ data }) {
  if (!data?.length) return <div className={styles.emptyState}>No vessels currently need berth allocation.</div>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.recTable}>
        <thead>
          <tr>
            <th>Vessel</th>
            <th>Status</th>
            <th>Recommended Berth</th>
            <th>Terminal</th>
            <th>Score</th>
            <th>Est. Wait</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec) => (
            <tr key={rec.vessel.vesselId}>
              <td>
                <div style={{ fontWeight: 600 }}>{rec.vessel.vesselName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {formatTEU(rec.vessel.sizeTEU)} · {rec.vessel.vesselId}
                </div>
              </td>
              <td>
                <RiskBadge level={rec.vessel.congestionRisk} />
              </td>
              <td>
                {rec.hasRecommendation ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {rec.bestBerth?.berthName}
                    {rec.crossTerminal && (
                      <span style={{ color: 'var(--risk-medium)', fontSize: '0.68rem', marginLeft: '4px' }}>
                        (cross-terminal)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className={styles.noMatch}>No match found</span>
                )}
              </td>
              <td className={styles.mono}>{rec.bestBerth?.terminalCode || '—'}</td>
              <td>
                <ScoreBar score={rec.allocationScore} />
              </td>
              <td className={styles.mono}>
                {rec.estimatedWaitingHours != null
                  ? rec.estimatedWaitingHours === 0
                    ? <span className={styles.ok}>Immediate</span>
                    : `${rec.estimatedWaitingHours.toFixed(1)}h`
                  : '—'}
              </td>
              <td>
                <div className={styles.reasonCell} title={rec.reason}>{rec.reason}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Crane recommendations table ───────────────────────────────────────────────
function CraneRecsTable({ data }) {
  if (!data?.length) return <div className={styles.emptyState}>No active vessels require crane allocation.</div>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.recTable}>
        <thead>
          <tr>
            <th>Vessel</th>
            <th>Required</th>
            <th>Allocated</th>
            <th>Available</th>
            <th>Shortfall</th>
            <th>Score</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec) => (
            <tr key={rec.vessel.vesselId}>
              <td>
                <div style={{ fontWeight: 600 }}>{rec.vessel.vesselName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {rec.vessel.terminalCode} · {formatTEU(rec.vessel.sizeTEU)}
                </div>
              </td>
              <td className={styles.mono}>{rec.requiredCranes}</td>
              <td className={styles.mono}>{rec.allocatedCranes.length}</td>
              <td className={styles.mono}>{rec.availableCranes}</td>
              <td>
                {rec.hasShortfall ? (
                  <span className={styles.shortfall}>
                    <AlertTriangle size={11} />
                    {rec.shortage}
                  </span>
                ) : (
                  <span className={styles.ok}>✓ OK</span>
                )}
              </td>
              <td>
                <ScoreBar score={rec.allocationScore} />
              </td>
              <td>
                <div className={styles.reasonCell} title={rec.reason}>{rec.reason}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Conflicts list ────────────────────────────────────────────────────────────
function ConflictList({ data }) {
  if (!data?.length) return (
    <div className={styles.emptyState}>
      <CheckCircle size={24} color="var(--risk-low)" style={{ marginBottom: '8px' }} />
      <div>No operational conflicts detected.</div>
    </div>
  );

  return (
    <div className={styles.conflictList}>
      {data.map((c, i) => (
        <div
          key={i}
          className={styles.conflictCard}
          style={{ borderLeftColor: SEVERITY_COLORS[c.severity] }}
        >
          <div className={styles.conflictHeader}>
            <div className={styles.conflictType}>
              {c.conflictType.replace(/_/g, ' ')}
            </div>
            <RiskBadge level={c.severity} />
          </div>
          <div className={styles.conflictExplanation}>{c.explanation}</div>
          {c.affectedVessels?.length > 0 && (
            <div className={styles.conflictVessels}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '4px' }}>Vessels:</span>
              {c.affectedVessels.map((v, j) => (
                <span key={j} className={styles.conflictVesselChip}>
                  {v.vesselName}
                </span>
              ))}
            </div>
          )}
          {c.affectedResources?.length > 0 && (
            <div className={styles.conflictVessels}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginRight: '4px' }}>Resources:</span>
              {c.affectedResources.map((r, j) => (
                <span key={j} className={styles.conflictResourceChip}>
                  {r.type}: {r.name || r.id}
                </span>
              ))}
            </div>
          )}
          <div className={styles.conflictResolution}>
            <span className={styles.conflictResolutionLabel}>Resolution:</span>
            <span>{c.suggestedResolution}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OptimizationCenterPage() {
  const [selectedTerminal, setSelectedTerminal] = useState('ALL');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  const fetchOptimize = useCallback(
    () => runOptimize(selectedTerminal === 'ALL' ? null : selectedTerminal),
    [selectedTerminal]
  );

  const { data: optData, loading, error, refetch } = useFetch(fetchOptimize, [fetchOptimize]);

  const result = optData?.data;
  const summary = result?.summary;
  const berthRecs = result?.berthRecommendations || [];
  const craneRecs = result?.craneRecommendations || [];
  const conflicts = result?.conflicts || [];

  async function handleRunOptimize() {
    setRunning(true);
    setRunError(null);
    try {
      await refetch();
    } catch (err) {
      setRunError(err.response?.data?.message || 'Optimization failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Settings2 size={18} color="var(--accent)" />
          <span className={styles.pageTitle}>Optimization Center</span>
          <span className={styles.demoNote}>DETERMINISTIC ENGINE · DEMO DATA</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.terminalTabs}>
            {TERMINALS.map((t) => (
              <button
                key={t}
                className={`${styles.terminalTab} ${selectedTerminal === t ? styles.terminalTabActive : ''}`}
                onClick={() => setSelectedTerminal(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.75rem' }}
            onClick={handleRunOptimize}
            disabled={running || loading}
          >
            <RefreshCw size={13} style={running || loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {running || loading ? 'Running…' : 'Run Optimization'}
          </button>
        </div>
      </div>

      {runError && (
        <div style={{ background: 'var(--risk-critical-bg)', border: '1px solid var(--risk-critical)',
          borderRadius: '6px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--risk-critical)' }}>
          {runError}
        </div>
      )}

      {loading && !result && <LoadingSpinner message="Running optimization engine…" />}
      {error && !result && <ErrorMessage message={error} onRetry={refetch} />}

      {result && (
        <>
          {/* ── Summary banner ── */}
          <SummaryBanner summary={summary} />

          {/* Meta row */}
          {summary && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Generated: {summary.generatedAt ? new Date(summary.generatedAt).toLocaleTimeString() : '—'}</span>
              <span>Estimated hours saved: <strong style={{ color: 'var(--risk-low)' }}>{summary.estimatedHoursSaved}h</strong></span>
              <span>{summary.dataLabel}</span>
            </div>
          )}

          {/* ── Berth Recommendations ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Anchor size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Berth Recommendations
              </span>
              <span className={styles.sectionCount}>
                {berthRecs.filter(r => r.hasRecommendation).length}/{berthRecs.length} matched
              </span>
            </div>
            <BerthRecsTable data={berthRecs} />
          </div>

          {/* ── Crane Recommendations ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <Cpu size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Crane Allocation
              </span>
              <span className={styles.sectionCount}>
                {craneRecs.filter(r => r.hasShortfall).length} shortfall(s)
              </span>
            </div>
            <CraneRecsTable data={craneRecs} />
          </div>

          {/* ── Conflicts ── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>
                <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Operational Conflicts
              </span>
              <span className={styles.sectionCount}>{conflicts.length} detected</span>
            </div>
            <ConflictList data={conflicts} />
          </div>
        </>
      )}
    </div>
  );
}
