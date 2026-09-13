import React, { useState, useCallback } from 'react';
import { Search, X, ChevronRight, Ship } from 'lucide-react';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import VesselDetailPanel from '../components/vessels/VesselDetailPanel';
import { getVessels } from '../api/vessels';
import { useFetch, useDebounce } from '../hooks/useFetch';
import { formatDateShort, formatTEU } from '../utils/formatters';
import styles from './VesselManagementPage.module.css';

const STATUS_OPTIONS = ['AT_BERTH', 'INBOUND', 'WAITING', 'DELAYED', 'DEPARTED'];
const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TERMINAL_OPTIONS = ['T1', 'T2', 'T3'];

export default function VesselManagementPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('');
  const [sortBy, setSortBy] = useState('arrivalTime');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const fetchVessels = useCallback(
    () =>
      getVessels({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        congestionRisk: riskFilter || undefined,
        terminalCode: terminalFilter || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      }),
    [debouncedSearch, statusFilter, riskFilter, terminalFilter, sortBy, sortOrder, page]
  );

  const { data, loading, error, refetch } = useFetch(fetchVessels, [fetchVessels]);

  const vessels = data?.data || [];
  const pagination = data?.pagination;

  function handleSort(field) {
    if (sortBy === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setRiskFilter('');
    setTerminalFilter('');
    setPage(1);
  }

  const hasFilters = search || statusFilter || riskFilter || terminalFilter;

  return (
    <div className={styles.page}>
      {/* Filters bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={`input ${styles.searchInput}`}
            placeholder="Search vessel name, ID, shipping line…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <select
          className={`input select ${styles.filterSelect}`}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>

        <select
          className={`input select ${styles.filterSelect}`}
          value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Risk Levels</option>
          {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          className={`input select ${styles.filterSelect}`}
          value={terminalFilter}
          onChange={e => { setTerminalFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Terminals</option>
          {TERMINAL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {hasFilters && (
          <button className="btn btn-ghost" onClick={clearFilters} title="Clear filters">
            <X size={14} /> Clear
          </button>
        )}

        <span className={styles.count}>
          {pagination ? `${pagination.total} vessels` : ''}
        </span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={selectedVessel ? styles.tableWrapNarrow : styles.tableWrap}>
          {loading && <LoadingSpinner message="Loading vessels…" />}
          {error && <ErrorMessage message={error} onRetry={refetch} />}
          {!loading && !error && (
            <>
              <div className={styles.tableScroll}>
                <table className="table">
                  <thead>
                    <tr>
                      <th
                        className={styles.sortable}
                        onClick={() => handleSort('vesselName')}
                      >
                        Vessel {sortBy === 'vesselName' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th
                        className={styles.sortable}
                        onClick={() => handleSort('sizeTEU')}
                      >
                        TEU {sortBy === 'sizeTEU' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>Status</th>
                      <th>Terminal / Berth</th>
                      <th
                        className={styles.sortable}
                        onClick={() => handleSort('arrivalTime')}
                      >
                        ETA {sortBy === 'arrivalTime' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>ETD</th>
                      <th>Risk</th>
                      <th
                        className={styles.sortable}
                        onClick={() => handleSort('waitingHours')}
                      >
                        Wait {sortBy === 'waitingHours' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vessels.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                          No vessels found
                        </td>
                      </tr>
                    ) : (
                      vessels.map(v => (
                        <tr
                          key={v._id}
                          className={`${styles.row} ${selectedVessel?._id === v._id ? styles.rowSelected : ''}`}
                          onClick={() => setSelectedVessel(v)}
                        >
                          <td>
                            <div className={styles.vesselName}>
                              <Ship size={13} color="var(--accent)" />
                              <span>{v.vesselName}</span>
                            </div>
                            <div className={styles.vesselSub}>{v.vesselId} · {v.shippingLine || '—'}</div>
                          </td>
                          <td className={styles.mono}>{formatTEU(v.sizeTEU)}</td>
                          <td><StatusBadge status={v.status} /></td>
                          <td>
                            <span style={{ color: 'var(--text-primary)' }}>{v.terminalCode || '—'}</span>
                            {v.assignedBerthId && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {' '}/ {v.assignedBerthId.name || v.assignedBerthId.berthId}
                              </span>
                            )}
                          </td>
                          <td className={styles.mono}>{formatDateShort(v.arrivalTime)}</td>
                          <td className={styles.mono}>{formatDateShort(v.estimatedDeparture)}</td>
                          <td><RiskBadge level={v.congestionRisk} /></td>
                          <td className={styles.mono}>
                            {v.waitingHours > 0 ? `${v.waitingHours.toFixed(1)}h` : '—'}
                          </td>
                          <td>
                            <ChevronRight size={14} color="var(--text-muted)" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className="btn btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {page} of {pagination.pages} ({pagination.total} total)
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        {selectedVessel && (
          <VesselDetailPanel
            vessel={selectedVessel}
            onClose={() => setSelectedVessel(null)}
          />
        )}
      </div>
    </div>
  );
}
