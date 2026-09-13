import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getAlerts } from '../../api/alerts';
import { useFetch } from '../../hooks/useFetch';
import styles from './TopNav.module.css';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/vessels': 'Vessel Management',
  '/port-overview': 'Port Overview',
  '/congestion': 'Congestion Analytics',
  '/optimization': 'Optimization Center',
  '/operations-plan': '72-Hour Operations Plan',
  '/ai-assistant': 'AI Operations Copilot',
  '/alerts': 'Alerts Center',
};

export default function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[pathname] || 'PortMind AI';

  const fetchUnacked = useCallback(
    () => getAlerts({ acknowledged: false, limit: 1 }),
    []
  );
  const { data: alertsRes } = useFetch(fetchUnacked);
  const alertCount = alertsRes?.pagination?.total ?? 0;

  return (
    <header className={styles.topnav}>
      <div className={styles.pageTitle}>
        <h1>{title}</h1>
        <span className={styles.demoTag}>DEMO DATA</span>
      </div>
      <div className={styles.right}>
        <button
          className={`btn btn-ghost ${styles.alertBtn}`}
          title={alertCount > 0 ? `${alertCount} unacknowledged alerts` : 'Alerts'}
          onClick={() => navigate('/alerts')}
        >
          <Bell size={16} />
          {alertCount > 0 && (
            <span className={styles.alertBadge}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>
        <div className={styles.timestamp}>
          {new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </header>
  );
}
