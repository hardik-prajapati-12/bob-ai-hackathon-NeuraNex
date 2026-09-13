import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ship,
  Anchor,
  TrendingUp,
  Settings2,
  Bot,
  ClipboardList,
  Bell,
  LogOut,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vessels', icon: Ship, label: 'Vessels' },
  { to: '/port-overview', icon: Anchor, label: 'Port Overview' },
  { to: '/congestion', icon: TrendingUp, label: 'Congestion Analytics' },
  { to: '/optimization', icon: Settings2, label: 'Optimization' },
  { to: '/operations-plan', icon: ClipboardList, label: 'Operations Plan' },
  { to: '/ai-assistant', icon: Bot, label: 'AI Copilot' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <Activity size={20} className={styles.logoIcon} />
        <div>
          <div className={styles.logoTitle}>PortMind AI</div>
          <div className={styles.logoSub}>Operations Command</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.displayName || user.username}</div>
            <div className={styles.userRole}>{user.role?.replace('_', ' ')}</div>
          </div>
        )}
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
