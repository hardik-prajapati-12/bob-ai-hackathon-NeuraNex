import React, { useState } from 'react';
import { Anchor } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import TerminalCard from '../components/port/TerminalCard';
import { getTerminals } from '../api/terminals';
import { useFetch } from '../hooks/useFetch';
import styles from './PortOverviewPage.module.css';

export default function PortOverviewPage() {
  const { data, loading, error, refetch } = useFetch(getTerminals);
  const terminals = data?.data || [];

  if (loading) return <LoadingSpinner message="Loading port overview…" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Anchor size={18} color="var(--accent)" />
          <span className={styles.headerTitle}>Live Port Status</span>
        </div>
        <span className={styles.demoNote}>SYNTHETIC DEMO DATA</span>
      </div>

      <div className={styles.grid}>
        {terminals.map(t => (
          <TerminalCard key={t._id} terminalId={t.terminalId} terminalData={t} />
        ))}
      </div>
    </div>
  );
}
