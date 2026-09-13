import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
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
  const title = PAGE_TITLES[pathname] || 'PortMind AI';

  return (
    <header className={styles.topnav}>
      <div className={styles.pageTitle}>
        <h1>{title}</h1>
        <span className={styles.demoTag}>DEMO DATA</span>
      </div>
      <div className={styles.right}>
        <button className={`btn btn-ghost ${styles.alertBtn}`} title="Alerts">
          <Bell size={16} />
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
