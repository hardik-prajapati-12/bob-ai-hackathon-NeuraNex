'use strict';

/**
 * PortMind AI — Crane Optimizer
 *
 * Recommends crane allocations for vessels requiring cranes
 * (AT_BERTH and WAITING vessels with requiredCranes > 0).
 *
 * Algorithm:
 *  1. For each vessel at a terminal, gather all cranes at that terminal
 *  2. Filter out MAINTENANCE / BREAKDOWN cranes
 *  3. Score usable cranes with allocationScorer
 *  4. Greedily assign top-N cranes (where N = vessel.requiredCranes)
 *     — mark cranes as "allocated" once assigned so they are not double-assigned
 *  5. Detect shortfall (requiredCranes > available cranes)
 *
 * Deterministic: same data → same result every time.
 */

const { scoreCraneForVessel } = require('./allocationScorer');

/**
 * Generate crane allocation recommendations for a list of vessels.
 *
 * @param {object[]} vessels  - vessels needing crane allocation
 * @param {object[]} cranes   - all cranes (lean documents)
 * @returns {object[]}        - one recommendation per vessel
 */
function recommendCranes(vessels, cranes) {
  // Track which cranes have been allocated in this pass (greedy approach).
  // Higher-priority / more-urgent vessels get cranes first.
  const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const STATUS_ORDER   = { DELAYED: 0, WAITING: 1, AT_BERTH: 2, INBOUND: 3 };

  const sorted = [...vessels].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (sd !== 0) return sd;
    return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  });

  // Set of allocated crane IDs (string) — one crane can only be assigned once per pass
  const allocatedCraneIds = new Set();

  return sorted.map(vessel => {
    const tc = vessel.terminalCode;
    const required = vessel.requiredCranes || 2;

    // Get cranes at this terminal
    const terminalCranes = cranes.filter(c => c.terminalCode === tc);

    // Filter to usable cranes (ACTIVE or IDLE) not yet allocated this pass
    const usableCranes = terminalCranes.filter(c => {
      if (c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN') return false;
      if (allocatedCraneIds.has(String(c._id))) return false;
      return true;
    });

    // Score usable cranes and sort descending
    const scored = usableCranes
      .map(crane => ({ crane, ...scoreCraneForVessel(vessel, crane) }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // Take top N cranes
    const allocated = scored.slice(0, required);
    const shortage = Math.max(0, required - allocated.length);

    // Mark these cranes as allocated for this optimization pass
    allocated.forEach(a => allocatedCraneIds.add(String(a.crane._id)));

    // Count unavailable cranes (maintenance/breakdown)
    const unavailableCranes = terminalCranes.filter(
      c => c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN'
    );

    // Build reason string
    let reason;
    if (shortage > 0) {
      reason = `Crane shortfall: ${required} cranes required but only ${allocated.length} ` +
        `available at terminal ${tc}. ${unavailableCranes.length} crane(s) in maintenance/breakdown.`;
    } else {
      reason = `${allocated.length} crane(s) allocated from terminal ${tc}. ` +
        `Avg lift capacity: ${
          allocated.length > 0
            ? Math.round(allocated.reduce((s, a) => s + (a.crane.liftCapacityTEUPerHour || 0), 0) / allocated.length)
            : 0
        } TEU/hr.`;
    }

    const allocationScore = allocated.length > 0
      ? parseFloat((allocated.reduce((s, a) => s + a.totalScore, 0) / allocated.length).toFixed(4))
      : 0;

    return {
      vessel: {
        _id: vessel._id,
        vesselId: vessel.vesselId,
        vesselName: vessel.vesselName,
        sizeTEU: vessel.sizeTEU,
        status: vessel.status,
        priority: vessel.priority,
        terminalCode: tc,
        requiredCranes: required,
        congestionRisk: vessel.congestionRisk,
      },
      requiredCranes: required,
      allocatedCranes: allocated.map(a => ({
        craneId: a.crane._id,
        craneCode: a.crane.craneId,
        craneName: a.crane.name,
        type: a.crane.type,
        status: a.crane.status,
        liftCapacityTEUPerHour: a.crane.liftCapacityTEUPerHour,
        utilizationPercent: a.crane.utilizationPercent,
        allocationScore: a.totalScore,
        factors: a.factors,
        reasons: a.reasons,
      })),
      availableCranes: usableCranes.length,
      totalTerminalCranes: terminalCranes.length,
      unavailableCranes: unavailableCranes.length,
      shortage,
      allocationScore,
      reason,
      hasShortfall: shortage > 0,
      hasSufficientCranes: shortage === 0,
    };
  });
}

module.exports = { recommendCranes };
