'use strict';

/**
 * PortMind AI — Historical Analyzer
 *
 * Analyzes the historicalOperations collection to surface congestion trends,
 * utilization patterns, and operational metrics for the frontend charts.
 */

const HistoricalOperation = require('../models/HistoricalOperation');

/**
 * Get recent daily historical records for one or all terminals.
 * Returns records sorted oldest → newest for chart rendering.
 *
 * @param {object} options
 * @param {string} [options.terminalCode] - optional filter; if omitted, all terminals
 * @param {number} [options.days=30] - number of days to look back
 * @returns {Promise<object[]>} sorted historical records
 */
async function getRecentHistory({ terminalCode, days = 30 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const filter = { date: { $gte: since } };
  if (terminalCode) filter.terminalCode = terminalCode;

  const records = await HistoricalOperation.find(filter)
    .sort({ date: 1 })
    .lean();

  return records;
}

/**
 * Aggregate daily records into per-terminal weekly averages.
 * Useful for high-level trend charts.
 *
 * @param {object[]} records - raw historicalOperation docs
 * @returns {object[]} weekly summaries per terminal
 */
function aggregateWeeklyTrend(records) {
  const byWeekTerminal = {};

  records.forEach((r) => {
    const d = new Date(r.date);
    // ISO week: Monday-based week number
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const key = `${r.terminalCode}__${weekStart.toISOString().split('T')[0]}`;

    if (!byWeekTerminal[key]) {
      byWeekTerminal[key] = {
        terminalCode: r.terminalCode,
        weekStart: weekStart.toISOString().split('T')[0],
        records: [],
      };
    }
    byWeekTerminal[key].records.push(r);
  });

  return Object.values(byWeekTerminal).map(({ terminalCode, weekStart, records: recs }) => {
    const count = recs.length;
    const avg = (field) =>
      parseFloat((recs.reduce((s, r) => s + (r[field] || 0), 0) / count).toFixed(2));

    return {
      terminalCode,
      weekStart,
      avgBerthUtilization: avg('avgBerthUtilizationPercent'),
      avgCraneUtilization: avg('avgCraneUtilizationPercent'),
      avgWaitingHours: avg('avgWaitingHours'),
      avgVesselCount: avg('vesselCount'),
      totalCongestionEvents: recs.reduce((s, r) => s + (r.congestionEvents || 0), 0),
      avgCongestionEvents: avg('congestionEvents'),
    };
  });
}

/**
 * Compute a congestion trend score from historical utilization metrics.
 * Re-uses the same formula weights to express historical congestion as a score.
 *
 * @param {object} record - historicalOperation document
 * @returns {number} estimated congestion score [0, 1]
 */
function historicalCongestionScore(record) {
  const berthFactor = Math.min(1, (record.avgBerthUtilizationPercent || 0) / 100);
  const queueFactor = Math.min(1, (record.avgWaitingHours || 0) / 12);
  const congestionEventFactor = Math.min(1, (record.congestionEvents || 0) / 5);

  return parseFloat(
    (0.40 * berthFactor + 0.35 * queueFactor + 0.25 * congestionEventFactor).toFixed(4)
  );
}

/**
 * Build chart-ready daily series for the frontend.
 * Each point contains date, terminal, and key metrics.
 *
 * @param {string} [terminalCode] - optional terminal filter
 * @param {number} [days=30]
 * @returns {Promise<object>} chart data grouped by terminal
 */
async function getDailyCongestionSeries({ terminalCode, days = 30 } = {}) {
  const records = await getRecentHistory({ terminalCode, days });

  // Group by terminal
  const byTerminal = {};
  records.forEach((r) => {
    if (!byTerminal[r.terminalCode]) byTerminal[r.terminalCode] = [];
    byTerminal[r.terminalCode].push({
      date: r.date,
      dateLabel: new Date(r.date).toISOString().split('T')[0],
      berthUtilization: r.avgBerthUtilizationPercent || 0,
      craneUtilization: r.avgCraneUtilizationPercent || 0,
      avgWaitingHours: r.avgWaitingHours || 0,
      vesselCount: r.vesselCount || 0,
      congestionEvents: r.congestionEvents || 0,
      congestionLevel: r.congestionLevel || 'NONE',
      estimatedCongestionScore: historicalCongestionScore(r),
    });
  });

  return { series: byTerminal, days, terminalCode: terminalCode || 'ALL' };
}

/**
 * Summary statistics for a terminal over a period.
 *
 * @param {string} terminalCode
 * @param {number} [days=30]
 * @returns {Promise<object>} summary stats
 */
async function getTerminalHistorySummary(terminalCode, days = 30) {
  const records = await getRecentHistory({ terminalCode, days });

  if (!records.length) {
    return {
      terminalCode,
      days,
      dataPoints: 0,
      avgBerthUtilization: 0,
      avgCraneUtilization: 0,
      avgWaitingHours: 0,
      peakWaitingHours: 0,
      totalCongestionEvents: 0,
      avgVesselCount: 0,
    };
  }

  const count = records.length;
  const avg = (field) =>
    parseFloat((records.reduce((s, r) => s + (r[field] || 0), 0) / count).toFixed(2));

  return {
    terminalCode,
    days,
    dataPoints: count,
    avgBerthUtilization: avg('avgBerthUtilizationPercent'),
    avgCraneUtilization: avg('avgCraneUtilizationPercent'),
    avgWaitingHours: avg('avgWaitingHours'),
    peakWaitingHours: Math.max(...records.map((r) => r.maxWaitingHours || 0)),
    totalCongestionEvents: records.reduce((s, r) => s + (r.congestionEvents || 0), 0),
    avgVesselCount: avg('vesselCount'),
  };
}

module.exports = {
  getRecentHistory,
  aggregateWeeklyTrend,
  getDailyCongestionSeries,
  getTerminalHistorySummary,
  historicalCongestionScore,
};
