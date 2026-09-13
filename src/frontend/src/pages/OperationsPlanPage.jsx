import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  RefreshCw,
  Loader,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Bot,
} from 'lucide-react';
import { generateOperationsPlan, getOperationsPlans } from '../api/ai';
import styles from './OperationsPlanPage.module.css';

// ─── Colour helpers ────────────────────────────────────────────────────────────

const RISK_COLORS = {
  CRITICAL: 'var(--risk-critical)',
  HIGH: 'var(--risk-high)',
  MEDIUM: 'var(--risk-medium)',
  LOW: 'var(--risk-low)',
};

const RISK_BG = {
  CRITICAL: 'var(--risk-critical-bg)',
  HIGH: 'var(--risk-high-bg)',
  MEDIUM: 'var(--risk-medium-bg)',
  LOW: 'var(--risk-low-bg)',
};

const PRIORITY_COLORS = {
  CRITICAL: 'var(--risk-critical)',
  HIGH: 'var(--risk-high)',
  MEDIUM: 'var(--risk-medium)',
  LOW: 'var(--risk-low)',
};

function riskColor(level) {
  return RISK_COLORS[level] || 'var(--text-muted)';
}

function formatConfidence(val) {
  if (val == null) return '—';
  return `${Math.round(val * 100)}%`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskPill({ level }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.4px',
        color: riskColor(level),
        background: RISK_BG[level] || 'rgba(100,116,139,0.15)',
        border: `1px solid ${riskColor(level)}44`,
      }}
    >
      {level || 'UNKNOWN'}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? 'var(--risk-low)' : pct >= 60 ? 'var(--risk-medium)' : 'var(--risk-high)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '60px',
          height: '4px',
          background: 'var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.4s',
          }}
        />
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pct}%</span>
    </div>
  );
}

function ActionCard({ action }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.actionCard}>
      <div className={styles.actionCardTop} onClick={() => setExpanded((p) => !p)}>
        <div className={styles.actionCardLeft}>
          <span
            className={styles.priorityDot}
            style={{ background: PRIORITY_COLORS[action.priority] || 'var(--text-muted)' }}
          />
          <span className={styles.actionText}>{action.action}</span>
        </div>
        <div className={styles.actionCardRight}>
          <RiskPill level={action.priority} />
          <span className={styles.expandIcon}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.actionCardBody}>
          {action.reason && (
            <div className={styles.actionDetailRow}>
              <span className={styles.detailLabel}>REASON</span>
              <span className={styles.detailValue}>{action.reason}</span>
            </div>
          )}
          {action.affectedResource && (
            <div className={styles.actionDetailRow}>
              <span className={styles.detailLabel}>RESOURCE</span>
              <span className={styles.detailValue}>
                {action.affectedResource}
                {action.affectedResourceType && action.affectedResourceType !== 'GENERAL' && (
                  <span className={styles.resourceType}> · {action.affectedResourceType}</span>
                )}
              </span>
            </div>
          )}
          {action.expectedBenefit && (
            <div className={styles.actionDetailRow}>
              <span className={styles.detailLabel}>BENEFIT</span>
              <span className={styles.detailValue}>{action.expectedBenefit}</span>
            </div>
          )}
          {action.confidence != null && (
            <div className={styles.actionDetailRow}>
              <span className={styles.detailLabel}>CONFIDENCE</span>
              <ConfidenceBar value={action.confidence} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const WINDOW_ICONS = {
  '0-12H': '🔴',
  '12-24H': '🟠',
  '24-48H': '🟡',
  '48-72H': '🟢',
};

function PlanWindow({ window: win }) {
  const [collapsed, setCollapsed] = useState(false);
  const icon = WINDOW_ICONS[win.label] || '⬜';

  return (
    <div className={styles.planWindow}>
      <div className={styles.windowHeader} onClick={() => setCollapsed((p) => !p)}>
        <div className={styles.windowHeaderLeft}>
          <span className={styles.windowIcon}>{icon}</span>
          <div>
            <div className={styles.windowLabel}>{win.label}</div>
            <div className={styles.windowTitle}>{win.title}</div>
          </div>
        </div>
        <div className={styles.windowHeaderRight}>
          <RiskPill level={win.riskLevel} />
          <span className={styles.collapseBtn}>
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.windowBody}>
          {win.summary && (
            <p className={styles.windowSummary}>{win.summary}</p>
          )}
          {win.actions && win.actions.length > 0 ? (
            <div className={styles.actionsList}>
              {win.actions.map((action, i) => (
                <ActionCard key={i} action={action} />
              ))}
            </div>
          ) : (
            <p className={styles.noActions}>No actions for this window.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OperationsPlanPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);

  // Load the most recent existing plan on mount
  const loadLatestPlan = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await getOperationsPlans();
      const plans = res.data;
      if (Array.isArray(plans) && plans.length > 0) {
        setPlan(plans[0]);
      }
    } catch (_) {
      // No existing plans — that's fine
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadLatestPlan();
  }, [loadLatestPlan]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateOperationsPlan();
      setPlan(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasPlan = plan && Array.isArray(plan.windows) && plan.windows.length > 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <ClipboardList size={22} color="var(--accent)" />
          <div>
            <h1 className={styles.title}>72-Hour Operations Plan</h1>
            <p className={styles.subtitle}>
              AI-generated structured plan across four time windows.
              Grounded in live port data.
            </p>
          </div>
        </div>
        <div className={styles.headerRight}>
          {hasPlan && plan.dataLabel && (
            <span className={styles.dataLabel}>{plan.dataLabel}</span>
          )}
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={15} className={styles.spin} />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Generate New Plan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading spinner (initial history load) */}
      {loadingHistory && !plan && (
        <div className={styles.loadingState}>
          <Loader size={28} className={styles.spin} style={{ color: 'var(--accent)' }} />
          <span>Loading latest plan…</span>
        </div>
      )}

      {/* Generating spinner */}
      {loading && (
        <div className={styles.generatingBanner}>
          <Bot size={18} color="var(--accent)" />
          <div>
            <div className={styles.generatingTitle}>IBM watsonx.ai is generating your 72-hour plan…</div>
            <div className={styles.generatingSubtitle}>
              Analysing congestion data, optimisation recommendations, and operational conflicts.
            </div>
          </div>
        </div>
      )}

      {/* No plan state */}
      {!loadingHistory && !loading && !hasPlan && (
        <div className={styles.emptyState}>
          <ClipboardList size={48} color="var(--accent)" style={{ opacity: 0.35 }} />
          <h2 className={styles.emptyTitle}>No plan generated yet</h2>
          <p className={styles.emptySubtitle}>
            Click <strong>Generate New Plan</strong> to create an AI-powered 72-hour operations plan
            based on current port conditions.
          </p>
          <button className={styles.generateBtnLarge} onClick={handleGenerate} disabled={loading}>
            <RefreshCw size={16} />
            Generate 72-Hour Plan
          </button>
        </div>
      )}

      {/* Plan content */}
      {!loading && hasPlan && (
        <div className={styles.planContent}>
          {/* Plan summary bar */}
          <div className={styles.planMeta}>
            <div className={styles.planMetaItem}>
              <span className={styles.planMetaLabel}>Generated</span>
              <span className={styles.planMetaValue}>{formatDate(plan.generatedAt)}</span>
            </div>
            <div className={styles.planMetaItem}>
              <span className={styles.planMetaLabel}>Overall Risk</span>
              <RiskPill level={plan.overallRiskLevel} />
            </div>
            <div className={styles.planMetaItem}>
              <span className={styles.planMetaLabel}>Provider</span>
              <span className={styles.planMetaValue}>
                {plan.generatedBy === 'AI_ENGINE' ? (
                  <>
                    <CheckCircle size={12} color="var(--risk-low)" /> IBM watsonx.ai
                  </>
                ) : (
                  <>
                    <Clock size={12} color="var(--risk-medium)" /> Analytical fallback
                  </>
                )}
              </span>
            </div>
            <div className={styles.planMetaItem}>
              <span className={styles.planMetaLabel}>Windows</span>
              <span className={styles.planMetaValue}>{plan.windows.length}</span>
            </div>
          </div>

          {/* Summary */}
          {plan.summary && (
            <div className={styles.planSummaryCard}>
              <div className={styles.planSummaryLabel}>PLAN SUMMARY</div>
              <p className={styles.planSummaryText}>{plan.summary}</p>
            </div>
          )}

          {/* Time windows */}
          <div className={styles.windowsGrid}>
            {plan.windows.map((win, i) => (
              <PlanWindow key={win.label || i} window={win} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
