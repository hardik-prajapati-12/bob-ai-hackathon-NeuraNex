import React, { useEffect, useState } from 'react';
import { Ship, AlertTriangle, Anchor, Activity } from 'lucide-react';
import KPICard from '../components/common/KPICard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import RiskBadge from '../components/common/RiskBadge';
import { getDashboardSummary } from '../api/dashboard';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary();
      setSummary(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchSummary} />;

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
          accentColor="var(--risk-high)"
        />
        <KPICard
          title="Berth Utilization"
          value={summary?.berthUtilization != null ? `${summary.berthUtilization}%` : '—'}
          subtitle="Across all terminals"
          icon={Anchor}
          accentColor={
            summary?.berthUtilization > 80
              ? 'var(--risk-critical)'
              : summary?.berthUtilization > 65
              ? 'var(--risk-high)'
              : 'var(--risk-low)'
          }
        />
        <KPICard
          title="Active Alerts"
          value={summary?.activeAlerts ?? '—'}
          subtitle="Requiring attention"
          icon={Activity}
          accentColor="var(--risk-medium)"
        />
      </div>

      {/* Status Row */}
      <div className={styles.statusRow}>
        <div className="card">
          <div className={styles.sectionHeader}>
            <h3>Congestion Status</h3>
            <RiskBadge level={summary?.congestionLevel || 'UNKNOWN'} size="lg" />
          </div>
          <p className={styles.statusDesc}>
            {summary?.congestionLevel === 'UNKNOWN'
              ? 'Connecting to live data — Phase 5 will populate this view.'
              : `Overall port congestion is currently ${summary.congestionLevel}.`}
          </p>
        </div>

        <div className="card">
          <div className={styles.sectionHeader}>
            <h3>System Status</h3>
          </div>
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
              <span className={styles.dot} style={{ background: 'var(--risk-medium)' }} />
              <span>AI Service</span>
              <span className={styles.statusPending}>Configure watsonx.ai</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data notice */}
      <div className={styles.notice}>
        <strong>Phase 2 Foundation:</strong> Backend, database connectivity, routing, and auth are
        verified. Dashboard data will populate with full metrics after Phase 3 (data model + seed
        data) and Phase 5 (analytics engine).
      </div>
    </div>
  );
}
