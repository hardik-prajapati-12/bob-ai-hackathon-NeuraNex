import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export function formatDate(dateStr, fmt = 'dd MMM yyyy HH:mm') {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  return isValid(d) ? format(d, fmt) : '—';
}

export function formatDateShort(dateStr) {
  return formatDate(dateStr, 'dd MMM HH:mm');
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

export function formatTEU(teu) {
  if (teu == null) return '—';
  return teu >= 1000 ? `${(teu / 1000).toFixed(1)}k TEU` : `${teu} TEU`;
}

export function formatPercent(val) {
  if (val == null) return '—';
  return `${Math.round(val)}%`;
}

export function riskColor(level) {
  const map = {
    LOW: 'var(--risk-low)',
    MEDIUM: 'var(--risk-medium)',
    HIGH: 'var(--risk-high)',
    CRITICAL: 'var(--risk-critical)',
  };
  return map[level?.toUpperCase()] || 'var(--text-muted)';
}

export function statusColor(status) {
  const map = {
    ACTIVE: 'var(--risk-low)',
    AVAILABLE: 'var(--risk-low)',
    AT_BERTH: 'var(--accent)',
    INBOUND: 'var(--risk-medium)',
    WAITING: 'var(--risk-high)',
    DELAYED: 'var(--risk-critical)',
    OCCUPIED: 'var(--accent)',
    MAINTENANCE: 'var(--text-muted)',
    IDLE: 'var(--text-muted)',
    DEPARTED: 'var(--text-muted)',
    BREAKDOWN: 'var(--risk-critical)',
  };
  return map[status?.toUpperCase()] || 'var(--text-muted)';
}
