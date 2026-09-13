'use strict';

/**
 * PortMind AI — Berth Optimizer
 *
 * For each vessel that needs berth allocation (WAITING, DELAYED, INBOUND),
 * scores all candidate berths and returns ranked recommendations.
 *
 * Algorithm:
 *  1. Load vessels needing allocation (WAITING / DELAYED first, then INBOUND)
 *  2. For each vessel, score all berths in its assigned terminal
 *     (or all terminals if no terminal assigned)
 *  3. Filter out incompatible berths (TEU too small, MAINTENANCE)
 *  4. Sort by totalScore descending
 *  5. Return top recommendation(s) per vessel with full explanation
 *
 * The same inputs always produce the same output (deterministic).
 */

const { scoreBerthForVessel } = require('./allocationScorer');

/**
 * Estimate waiting hours for a vessel given the best berth recommendation.
 * @param {object} vessel
 * @param {object} berth
 * @returns {number}
 */
function estimateWaitingHours(vessel, berth) {
  if (berth.currentStatus === 'AVAILABLE') return 0;
  if (!berth.availableFrom) return 4; // unknown — estimate

  const eta = vessel.arrivalTime ? new Date(vessel.arrivalTime) : new Date();
  const freeAt = new Date(berth.availableFrom);
  const waitMs = freeAt - eta;
  return Math.max(0, parseFloat((waitMs / 3600000).toFixed(2)));
}

/**
 * Generate berth recommendations for a list of vessels.
 *
 * @param {object[]} vessels  - vessels needing berth allocation
 * @param {object[]} berths   - all berths (lean documents)
 * @param {Date}     [now]    - reference time (default: new Date())
 * @returns {object[]}        - one recommendation object per vessel
 */
function recommendBerths(vessels, berths, now = new Date()) {
  const results = [];

  // Sort vessels: WAITING/DELAYED first (more urgent), then by priority
  const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const STATUS_ORDER   = { DELAYED: 0, WAITING: 1, INBOUND: 2, AT_BERTH: 3 };

  const sorted = [...vessels].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  });

  sorted.forEach(vessel => {
    // Filter berths to candidate pool:
    // — must be in the vessel's terminal (if assigned), or any terminal
    // — must not be MAINTENANCE
    const candidates = berths.filter(b => {
      // Exclude MAINTENANCE / RESERVED berths
      if (b.currentStatus === 'MAINTENANCE' || b.currentStatus === 'RESERVED') return false;
      // If vessel has a terminal assignment, prefer same terminal
      // (we don't hard-filter here — let the scorer penalize cross-terminal)
      return true;
    });

    if (!candidates.length) {
      results.push({
        vessel: {
          _id: vessel._id,
          vesselId: vessel.vesselId,
          vesselName: vessel.vesselName,
          sizeTEU: vessel.sizeTEU,
          status: vessel.status,
          priority: vessel.priority,
          terminalCode: vessel.terminalCode,
          arrivalTime: vessel.arrivalTime,
          congestionRisk: vessel.congestionRisk,
        },
        recommendations: [],
        bestBerth: null,
        allocationScore: 0,
        estimatedWaitingHours: null,
        reason: 'No candidate berths found in the system',
        hasRecommendation: false,
      });
      return;
    }

    // Score each candidate
    const scored = candidates
      .map(berth => {
        const result = scoreBerthForVessel(vessel, berth, now);
        return { berth, ...result };
      })
      .filter(r => r.compatible) // only compatible berths
      .sort((a, b) => b.totalScore - a.totalScore);

    const best = scored[0] || null;

    // Boost score for same-terminal berths
    // (already handled by scorer — the terminal factor is reflected in availability/rate)
    // Explicitly flag cross-terminal recommendations
    const isCrossTerminal = best && best.berth.terminalCode !== vessel.terminalCode;

    results.push({
      vessel: {
        _id: vessel._id,
        vesselId: vessel.vesselId,
        vesselName: vessel.vesselName,
        sizeTEU: vessel.sizeTEU,
        status: vessel.status,
        priority: vessel.priority,
        terminalCode: vessel.terminalCode,
        arrivalTime: vessel.arrivalTime,
        congestionRisk: vessel.congestionRisk,
        waitingHours: vessel.waitingHours,
      },
      recommendations: scored.slice(0, 3).map(r => ({
        berthId: r.berth._id,
        berthCode: r.berth.berthId,
        berthName: r.berth.name,
        terminalCode: r.berth.terminalCode,
        currentStatus: r.berth.currentStatus,
        maxVesselSizeTEU: r.berth.maxVesselSizeTEU,
        processingRateTEUPerHour: r.berth.processingRateTEUPerHour,
        availableFrom: r.berth.availableFrom,
        allocationScore: r.totalScore,
        factors: r.factors,
        reasons: r.reasons,
        estimatedWaitingHours: estimateWaitingHours(vessel, r.berth),
        crossTerminal: r.berth.terminalCode !== vessel.terminalCode,
      })),
      bestBerth: best ? {
        berthId: best.berth._id,
        berthCode: best.berth.berthId,
        berthName: best.berth.name,
        terminalCode: best.berth.terminalCode,
        currentStatus: best.berth.currentStatus,
        maxVesselSizeTEU: best.berth.maxVesselSizeTEU,
      } : null,
      allocationScore: best ? best.totalScore : 0,
      estimatedWaitingHours: best ? estimateWaitingHours(vessel, best.berth) : null,
      reason: best
        ? best.reasons.join('; ')
        : 'No compatible berth found — vessel TEU may exceed all berth capacities',
      crossTerminal: isCrossTerminal,
      hasRecommendation: !!best,
    });
  });

  return results;
}

module.exports = { recommendBerths, estimateWaitingHours };
