import React, { useState, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Anchor,
  Cpu,
  Ship,
  BarChart2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import RiskBadge from '../components/common/RiskBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import {
  getCongestionCurrent,
  getCongestionPredictions,
  runPrediction,
  getCongestionHistory,
} from '../api/congestion';
import { useFetch } from '../hooks/useFetch';
import { riskColor } from '../utils/formatters';
import { timeAgo } from '../utils/formatters';
import styles from './CongestionAnalyticsPage.module.css';

const HORIZONS = ['6H', '12H', '24H', '72H'];

const FACTOR_LABELS = {
  berthUtilizationFactor: 'Berth Utilization',
  vesselQueueFactor: 'Vessel Queue',
  arrivalRateFactor: 'Arrival Rate',
  craneShortfallFactor: 'Crane Shortfall',
  largeVesselFactor: 'Large Vessels',
};

const TERMINAL_COLORS = {
  T1: '#3b82f6',
  T2: '#f59e0b',
  T3: '#ef4444',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreGauge({ score, level }) {
  const color = riskColor(level);
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeLabel}>
        <span>Congestion</span>
        <span style={{ color }}>{Math.round(score * 100)}%</span>
      </div>
      <div className={styles.gaugeTrack}>
        <div
          className={styles.gaugeFill}
          style={{ width: `${Math.min(100, score * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function FactorBar({ label, value, weight }) {
  const weightedVal = value * weight;
  const color =
    weightedVal > 0.15
      ? 'var(--risk-critical)'
      : weightedVal > 0.10
      ? 'var(--risk-high)'
      : weightedVal > 0.06
      ? 'var(--risk-medium)'
      : 'var(--risk-low)';

  return (
    <div className={styles.factorItem}>
      <span className={styles.factorName}>{label}</span>
      <div className={styles.factorBarRow}>
        <div className={styles.factorBar}>
          <div
            className={styles.factorBarFill}
            style={{ width: `${Math.min(100, value * 100)}%`, background: color }}
          />
        </div>
        <span className={styles.factorValue}>{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}

function TerminalCongestionCard({ assessment, horizon, onPredict, predicting }) {
  const { terminalCode, terminalName, congestionScore, congestionLevel, factorInputs, snapshot } =
    assessment;
  const scoreColor = riskColor(congestionLevel);

  return (
    <div className={styles.terminalCard}>
      {/* Header */}
      <div className={styles.tcHeader}>
        <div>
          <div className={styles.tcName}>{terminalName}</div>
          <div className={styles.tcCode}>{terminalCode}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.tcScore} style={{ color: scoreColor }}>
            {Math.round(congestionScore * 100)}
          </div>
          <RiskBadge level={congestionLevel} />
        </div>
      </div>

      {/* Score gauge */}
      <ScoreGauge score={congestionScore} level={congestionLevel} />

      {/* Snapshot stats row */}
      {snapshot && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            padding: '4px 0',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {snapshot.berths?.occupied ?? '—'}/{snapshot.berths?.active ?? '—'}
            </div>
            Berths occupied
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {snapshot.vessels?.queuedVessels ?? '—'}
            </div>
            Vessels waiting
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {snapshot.cranes?.active ?? '—'}/{snapshot.cranes?.total ?? '—'}
            </div>
            Cranes active
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      {factorInputs && (
        <div className={styles.factorGrid}>
          {Object.entries(FACTOR_LABELS).map(([key, label]) => (
            <FactorBar
              key={key}
              label={label}
              value={factorInputs[key] ?? 0}
              weight={0.2} // approximate for color scaling
            />
          ))}
        </div>
      )}

      {/* Predict button */}
      <button
        className="btn btn-secondary"
        style={{ fontSize: '0.75rem', padding: '6px 10px', marginTop: '4px' }}
        onClick={() => onPredict(terminalCode, horizon)}
        disabled={predicting === terminalCode}
      >
        {predicting === terminalCode ? (
          <>
            <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
            Running…
          </>
        ) : (
          <>
            <TrendingUp size={11} />
            Predict {horizon}
          </>
        )}
      </button>
    </div>
  );
}

// ── Historical chart ──────────────────────────────────────────────────────────

function HistoricalTrendChart({ historyData }) {
  if (!historyData?.series) return null;

  const { series } = historyData;
  const terminals = Object.keys(series);

  if (!terminals.length) {
    return <div className={styles.emptyState}>No historical data available.</div>;
  }

  // Build unified chart data: one row per date, columns per terminal
  const dateMap = {};
  terminals.forEach((tc) => {
    (series[tc] || []).forEach((pt) => {
      if (!dateMap[pt.dateLabel]) dateMap[pt.dateLabel] = { date: pt.dateLabel };
      dateMap[pt.dateLabel][`${tc}_util`] = pt.berthUtilization;
      dateMap[pt.dateLabel][`${tc}_score`] = Math.round(pt.estimatedCongestionScore * 100);
      dateMap[pt.dateLabel][`${tc}_wait`] = pt.avgWaitingHours;
    });
  });

  const chartData = Object.values(dateMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Show last 30 points max to avoid cluttering
  const displayData = chartData.slice(-30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Berth utilization trend */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Berth Utilization % (daily average)
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => v.slice(5)} /* MM-DD */
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '0.75rem',
              }}
              formatter={(v) => [`${v}%`]}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
            />
            {terminals.map((tc) => (
              <Line
                key={tc}
                type="monotone"
                dataKey={`${tc}_util`}
                name={`${tc} Berth Util`}
                stroke={TERMINAL_COLORS[tc] || '#888'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Estimated congestion score trend */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Estimated Congestion Score (0–100)
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '0.75rem',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
            />
            {terminals.map((tc) => (
              <Line
                key={tc}
                type="monotone"
                dataKey={`${tc}_score`}
                name={`${tc} Score`}
                stroke={TERMINAL_COLORS[tc] || '#888'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Stored predictions table ──────────────────────────────────────────────────

function PredictionsTable({ predictions }) {
  if (!predictions?.length) {
    return (
      <div className={styles.emptyState}>
        No stored predictions yet. Use the terminal cards above to generate one.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={styles.predTable}>
        <thead>
          <tr>
            <th>Terminal</th>
            <th>Horizon</th>
            <th>Score</th>
            <th>Level</th>
            <th>Predicted Wait</th>
            <th>Berth Util.</th>
            <th>Queue</th>
            <th>Confidence</th>
            <th>Generated</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((p) => (
            <tr key={p._id}>
              <td>{p.terminalCode}</td>
              <td className={styles.mono}>{p.horizon}</td>
              <td className={styles.mono} style={{ color: riskColor(p.riskLevel) }}>
                {Math.round(p.congestionScore * 100)}
              </td>
              <td>
                <RiskBadge level={p.riskLevel} />
              </td>
              <td className={styles.mono}>{p.predictedWaitingHours?.toFixed(1)}h</td>
              <td className={styles.mono}>
                {Math.round((p.berthUtilizationForecast || 0) * 100)}%
              </td>
              <td className={styles.mono}>{p.vesselQueueForecast ?? '—'}</td>
              <td className={styles.mono}>
                {Math.round((p.confidence || 0) * 100)}%
              </td>
              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {timeAgo(p.generatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CongestionAnalyticsPage() {
  const [selectedHorizon, setSelectedHorizon] = useState('24H');
  const [predicting, setPredicting] = useState(null);
  const [predictError, setPredictError] = useState(null);

  // Live data fetches
  const { data: currentData, loading: currentLoading, error: currentError, refetch: refetchCurrent } =
    useFetch(getCongestionCurrent, []);

  const fetchPredictions = useCallback(
    () => getCongestionPredictions({ limit: 20 }),
    []
  );
  const { data: predsData, loading: predsLoading, refetch: refetchPreds } =
    useFetch(fetchPredictions, [fetchPredictions]);

  const fetchHistory = useCallback(
    () => getCongestionHistory({ days: 30 }),
    []
  );
  const { data: historyData, loading: historyLoading } = useFetch(fetchHistory, [fetchHistory]);

  const current = currentData?.data;
  const predictions = predsData?.data || [];

  // Run prediction for a specific terminal + horizon
  async function handlePredict(terminalCode, horizon) {
    setPredicting(terminalCode);
    setPredictError(null);
    try {
      await runPrediction(terminalCode, horizon);
      await Promise.all([refetchCurrent(), refetchPreds()]);
    } catch (err) {
      setPredictError(
        err.response?.data?.message || 'Prediction failed. Check console for details.'
      );
    } finally {
      setPredicting(null);
    }
  }

  const levelColor = (lvl) => riskColor(lvl);

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <TrendingUp size={18} color="var(--accent)" />
          <span className={styles.pageTitle}>Congestion Analytics</span>
          <span className={styles.demoNote}>ANALYTICAL MODEL · DEMO DATA</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.horizonTabs}>
            {HORIZONS.map((h) => (
              <button
                key={h}
                className={`${styles.horizonTab} ${selectedHorizon === h ? styles.horizonTabActive : ''}`}
                onClick={() => setSelectedHorizon(h)}
              >
                {h}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem' }}
            onClick={refetchCurrent}
            disabled={currentLoading}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {predictError && (
        <div
          style={{
            background: 'var(--risk-critical-bg)',
            border: '1px solid var(--risk-critical)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: 'var(--risk-critical)',
          }}
        >
          {predictError}
        </div>
      )}

      {/* ── Overall port congestion banner ── */}
      {currentLoading && <LoadingSpinner message="Calculating congestion…" />}
      {currentError && <ErrorMessage message={currentError} onRetry={refetchCurrent} />}

      {current && (
        <>
          <div
            className={styles.overallBanner}
            style={{
              borderColor: levelColor(current.overallLevel),
              boxShadow: `0 0 0 1px ${levelColor(current.overallLevel)}22`,
            }}
          >
            <div className={styles.bannerLeft}>
              <AlertTriangle
                size={28}
                color={levelColor(current.overallLevel)}
              />
              <div className={styles.bannerMeta}>
                <div className={styles.bannerTitle}>Overall Port Congestion</div>
                <div
                  className={styles.bannerLevel}
                  style={{ color: levelColor(current.overallLevel) }}
                >
                  {current.overallLevel}
                </div>
                <div className={styles.bannerTimestamp}>
                  Score: {Math.round(current.overallScore * 100)} ·{' '}
                  {current.generatedAt
                    ? `Updated ${timeAgo(current.generatedAt)}`
                    : 'Live'}
                </div>
              </div>
            </div>
            <div className={styles.bannerRight}>
              {current.terminals && [
                {
                  icon: Anchor,
                  label: 'Terminals',
                  value: current.terminals.length,
                },
                {
                  icon: Ship,
                  label: 'Waiting',
                  value: current.terminals.reduce(
                    (s, t) => s + (t.snapshot?.vessels?.queuedVessels || 0),
                    0
                  ),
                },
                {
                  icon: Cpu,
                  label: 'Cranes active',
                  value: current.terminals.reduce(
                    (s, t) => s + (t.snapshot?.cranes?.active || 0),
                    0
                  ),
                },
                {
                  icon: BarChart2,
                  label: 'Critical',
                  value: current.terminals.filter(
                    (t) => t.congestionLevel === 'CRITICAL'
                  ).length,
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className={styles.bannerStat}>
                  <div className={styles.bannerStatValue}>{value}</div>
                  <div className={styles.bannerStatLabel}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Terminal congestion cards ── */}
          <div>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Terminal Congestion — {selectedHorizon} View</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Click "Predict {selectedHorizon}" to generate & save a forecast
              </span>
            </div>
            <div className={styles.terminalGrid}>
              {(current.terminals || []).map((assessment) => (
                <TerminalCongestionCard
                  key={assessment.terminalCode}
                  assessment={assessment}
                  horizon={selectedHorizon}
                  onPredict={handlePredict}
                  predicting={predicting}
                />
              ))}
            </div>
          </div>

          {/* ── Contributing factors for most congested terminal ── */}
          {(() => {
            const worst = [...(current.terminals || [])].sort(
              (a, b) => b.congestionScore - a.congestionScore
            )[0];
            if (!worst?.contributingFactors?.length) return null;
            return (
              <div className={styles.factorsPanel}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    Contributing Factors —{' '}
                    <span style={{ color: riskColor(worst.congestionLevel) }}>
                      {worst.terminalName}
                    </span>
                    {' '}
                    <RiskBadge level={worst.congestionLevel} />
                  </span>
                </div>
                {worst.contributingFactors.map((f) => (
                  <div key={f.factor} className={styles.factorRow}>
                    <div className={styles.factorRowLeft}>
                      {f.factor.replace(/_/g, ' ')}
                    </div>
                    <div className={styles.factorRowDesc}>{f.description}</div>
                    <div className={styles.factorRowWeight}>
                      wt {Math.round(f.weight * 100)}% · val {Math.round(f.value * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* ── Stored predictions table ── */}
      <div>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Stored Predictions</span>
          {predsLoading && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Loading…
            </span>
          )}
        </div>
        <div className={styles.chartCard} style={{ padding: 0, overflow: 'hidden' }}>
          <PredictionsTable predictions={predictions} />
        </div>
      </div>

      {/* ── Historical trend chart ── */}
      <div>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Historical Trend — Last 30 Days</span>
          {historyLoading && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading…</span>
          )}
        </div>
        <div className={styles.chartCard}>
          {historyData?.data ? (
            <HistoricalTrendChart historyData={historyData.data} />
          ) : historyLoading ? null : (
            <div className={styles.emptyState}>No historical data found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
