'use strict';

/**
 * PortMind AI — Conflict Detector
 *
 * Detects operational conflicts across vessels, berths, cranes, and schedules.
 * Returns structured conflict objects with type, severity, affected resources,
 * and a suggested resolution.
 *
 * Conflict types:
 *   BERTH_COMPETITION         — multiple vessels competing for the same berth
 *   BERTH_UNAVAILABLE         — berth not free during vessel ETA window
 *   BERTH_SIZE_INCOMPATIBLE   — vessel TEU exceeds berth max TEU
 *   CRANE_COMPETITION         — multiple vessels assigned the same crane
 *   CRANE_MAINTENANCE         — vessel requires a crane that is in maintenance
 *   CRANE_SHORTFALL           — vessel requires more cranes than available
 *   SCHEDULE_OVERLAP          — two vessel schedules overlap at the same berth
 *   TERMINAL_CONTENTION       — terminal berth utilization at/above capacity
 *
 * Severity levels: CRITICAL | HIGH | MEDIUM | LOW
 */

const SEVERITY = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

/** Build a conflict object. */
function makeConflict(type, severity, affectedVessels, affectedResources, explanation, suggestedResolution) {
  return {
    conflictType: type,
    severity,
    affectedVessels: affectedVessels.map(v => ({
      vesselId: v.vesselId || v._id,
      vesselName: v.vesselName,
      status: v.status,
      priority: v.priority,
    })),
    affectedResources,
    explanation,
    suggestedResolution,
  };
}

// ─── 1. Berth Competition ────────────────────────────────────────────────────

/**
 * Detect multiple vessels WAITING or INBOUND competing for the same AVAILABLE berth.
 * Groups competing vessels by the terminal's available berths and compares queue depth.
 *
 * @param {object[]} vessels
 * @param {object[]} berths
 * @returns {object[]} conflicts
 */
function detectBerthCompetition(vessels, berths) {
  const conflicts = [];

  // Group available berths by terminal
  const availableByTerminal = {};
  berths.forEach(b => {
    if (b.currentStatus === 'AVAILABLE') {
      const tc = b.terminalCode;
      if (!availableByTerminal[tc]) availableByTerminal[tc] = [];
      availableByTerminal[tc].push(b);
    }
  });

  // Group competing vessels (WAITING or DELAYED) by terminal
  const competingByTerminal = {};
  vessels.forEach(v => {
    if (v.status === 'WAITING' || v.status === 'DELAYED') {
      const tc = v.terminalCode;
      if (!tc) return;
      if (!competingByTerminal[tc]) competingByTerminal[tc] = [];
      competingByTerminal[tc].push(v);
    }
  });

  Object.keys(competingByTerminal).forEach(tc => {
    const competing = competingByTerminal[tc];
    const available = (availableByTerminal[tc] || []).length;

    if (competing.length > available) {
      const excess = competing.length - available;
      const severity = excess >= 3 ? SEVERITY.CRITICAL : excess >= 2 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
      const affectedResources = (availableByTerminal[tc] || []).map(b => ({
        type: 'BERTH',
        id: b.berthId,
        name: b.name,
        terminalCode: b.terminalCode,
      }));

      conflicts.push(makeConflict(
        'BERTH_COMPETITION',
        severity,
        competing,
        affectedResources,
        `${competing.length} vessels competing for ${available} available berth(s) at ${tc}. ` +
        `${excess} vessel(s) cannot be immediately assigned.`,
        `Reassign lower-priority vessels to adjacent terminals, or expedite departure of ` +
        `currently berthed vessels to free capacity sooner.`
      ));
    }
  });

  return conflicts;
}

// ─── 2. Berth Unavailability Window ─────────────────────────────────────────

/**
 * Detect vessels assigned to occupied berths where the berth won't free up in time.
 */
function detectBerthUnavailability(vessels, berths) {
  const conflicts = [];
  const berthMap = {};
  berths.forEach(b => { berthMap[String(b._id)] = b; });

  vessels.forEach(v => {
    if (!v.assignedBerthId) return;
    const berthId = String(v.assignedBerthId._id || v.assignedBerthId);
    const berth = berthMap[berthId];
    if (!berth) return;

    if (berth.currentStatus === 'OCCUPIED' && berth.availableFrom) {
      const eta = v.arrivalTime ? new Date(v.arrivalTime) : new Date();
      const freeAt = new Date(berth.availableFrom);
      const waitHours = (freeAt - eta) / 3600000;

      if (waitHours > 2) {
        const severity = waitHours > 12 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
        conflicts.push(makeConflict(
          'BERTH_UNAVAILABLE',
          severity,
          [v],
          [{ type: 'BERTH', id: berth.berthId, name: berth.name, terminalCode: berth.terminalCode }],
          `Vessel ${v.vesselName} ETA is ${eta.toISOString().replace('T', ' ').slice(0, 16)} ` +
          `but berth ${berth.name} is occupied and free at ` +
          `${freeAt.toISOString().replace('T', ' ').slice(0, 16)} (~${waitHours.toFixed(1)}h wait).`,
          `Assign vessel to an alternative available berth, or notify vessel to adjust arrival time.`
        ));
      }
    }

    if (berth.currentStatus === 'MAINTENANCE') {
      conflicts.push(makeConflict(
        'BERTH_UNAVAILABLE',
        SEVERITY.HIGH,
        [v],
        [{ type: 'BERTH', id: berth.berthId, name: berth.name, terminalCode: berth.terminalCode }],
        `Vessel ${v.vesselName} is assigned to ${berth.name} which is under MAINTENANCE.`,
        `Reassign vessel to an available berth in the same or adjacent terminal.`
      ));
    }
  });

  return conflicts;
}

// ─── 3. Berth Size Incompatibility ───────────────────────────────────────────

/**
 * Detect vessels assigned to berths that are too small for them.
 */
function detectBerthSizeIncompatibility(vessels, berths) {
  const conflicts = [];
  const berthMap = {};
  berths.forEach(b => { berthMap[String(b._id)] = b; });

  vessels.forEach(v => {
    if (!v.assignedBerthId) return;
    const berthId = String(v.assignedBerthId._id || v.assignedBerthId);
    const berth = berthMap[berthId];
    if (!berth) return;

    if ((v.sizeTEU || 0) > (berth.maxVesselSizeTEU || 0)) {
      conflicts.push(makeConflict(
        'BERTH_SIZE_INCOMPATIBLE',
        SEVERITY.CRITICAL,
        [v],
        [{ type: 'BERTH', id: berth.berthId, name: berth.name, terminalCode: berth.terminalCode }],
        `Vessel ${v.vesselName} (${v.sizeTEU} TEU) exceeds berth ${berth.name} max capacity (${berth.maxVesselSizeTEU} TEU).`,
        `Reassign vessel to a berth with sufficient TEU capacity (≥ ${v.sizeTEU} TEU).`
      ));
    }
  });

  return conflicts;
}

// ─── 4. Crane Maintenance Conflict ───────────────────────────────────────────

/**
 * Detect vessels assigned to cranes that are under maintenance or broken down.
 */
function detectCraneMaintenanceConflict(vessels, cranes) {
  const conflicts = [];
  const craneMap = {};
  cranes.forEach(c => { craneMap[String(c._id)] = c; });

  vessels.forEach(v => {
    if (!v.assignedCraneIds?.length) return;
    const badCranes = v.assignedCraneIds
      .map(id => craneMap[String(id._id || id)])
      .filter(c => c && (c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN'));

    if (badCranes.length) {
      conflicts.push(makeConflict(
        'CRANE_MAINTENANCE',
        SEVERITY.HIGH,
        [v],
        badCranes.map(c => ({ type: 'CRANE', id: c.craneId, name: c.name, terminalCode: c.terminalCode })),
        `Vessel ${v.vesselName} has ${badCranes.length} assigned crane(s) in MAINTENANCE/BREAKDOWN: ` +
        `${badCranes.map(c => c.name).join(', ')}.`,
        `Replace with available ACTIVE or IDLE cranes at the same terminal.`
      ));
    }
  });

  return conflicts;
}

// ─── 5. Crane Shortfall ───────────────────────────────────────────────────────

/**
 * Detect vessels at a terminal where available active cranes are insufficient
 * for the combined requirements of AT_BERTH + WAITING vessels.
 */
function detectCraneShortfall(vessels, cranes, terminals) {
  const conflicts = [];

  // Build maps keyed by terminalCode
  const vesselsByTerminal = {};
  vessels.forEach(v => {
    const tc = v.terminalCode;
    if (!tc) return;
    if (!vesselsByTerminal[tc]) vesselsByTerminal[tc] = [];
    vesselsByTerminal[tc].push(v);
  });

  const cranesByTerminal = {};
  cranes.forEach(c => {
    const tc = c.terminalCode;
    if (!cranesByTerminal[tc]) cranesByTerminal[tc] = [];
    cranesByTerminal[tc].push(c);
  });

  const terminalMap = {};
  terminals.forEach(t => { terminalMap[t.terminalId] = t; });

  Object.keys(vesselsByTerminal).forEach(tc => {
    const tcVessels = vesselsByTerminal[tc] || [];
    const tcCranes = cranesByTerminal[tc] || [];

    // Total cranes required by active vessels (AT_BERTH + WAITING + DELAYED)
    const requiredCranes = tcVessels
      .filter(v => ['AT_BERTH', 'WAITING', 'DELAYED'].includes(v.status))
      .reduce((sum, v) => sum + (v.requiredCranes || 2), 0);

    const activeCranes = tcCranes.filter(c => c.status === 'ACTIVE' || c.status === 'IDLE').length;
    const maintenanceCranes = tcCranes.filter(c => c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN').length;

    const shortfall = requiredCranes - activeCranes;

    if (shortfall > 0) {
      const severity = shortfall >= 4 ? SEVERITY.CRITICAL : shortfall >= 2 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
      const affectedVessels = tcVessels.filter(v => ['AT_BERTH', 'WAITING', 'DELAYED'].includes(v.status));

      conflicts.push(makeConflict(
        'CRANE_SHORTFALL',
        severity,
        affectedVessels.slice(0, 8), // cap for readability
        [{ type: 'TERMINAL', id: tc, name: terminalMap[tc]?.name || tc, terminalCode: tc }],
        `Terminal ${tc} has ${activeCranes} active/idle crane(s) but ${requiredCranes} are required ` +
        `by ${affectedVessels.length} active vessel(s). Shortfall: ${shortfall} crane(s). ` +
        `${maintenanceCranes} crane(s) currently in maintenance.`,
        `Expedite crane maintenance to restore ${Math.min(shortfall, maintenanceCranes)} crane(s), ` +
        `or redistribute vessels to terminals with adequate crane capacity.`
      ));
    }
  });

  return conflicts;
}

// ─── 6. Crane Competition ────────────────────────────────────────────────────

/**
 * Detect two vessels assigned to the same crane at the same time.
 */
function detectCraneCompetition(vessels, cranes) {
  const conflicts = [];
  const craneToVessels = {};

  vessels.forEach(v => {
    if (!v.assignedCraneIds?.length) return;
    if (!['AT_BERTH', 'WAITING'].includes(v.status)) return;
    v.assignedCraneIds.forEach(id => {
      const cId = String(id._id || id);
      if (!craneToVessels[cId]) craneToVessels[cId] = [];
      craneToVessels[cId].push(v);
    });
  });

  const craneMap = {};
  cranes.forEach(c => { craneMap[String(c._id)] = c; });

  Object.entries(craneToVessels).forEach(([craneId, assignedVessels]) => {
    if (assignedVessels.length > 1) {
      const crane = craneMap[craneId];
      conflicts.push(makeConflict(
        'CRANE_COMPETITION',
        SEVERITY.HIGH,
        assignedVessels,
        [{
          type: 'CRANE',
          id: crane?.craneId || craneId,
          name: crane?.name || craneId,
          terminalCode: crane?.terminalCode,
        }],
        `${assignedVessels.length} vessels (${assignedVessels.map(v => v.vesselName).join(', ')}) ` +
        `are assigned to the same crane ${crane?.name || craneId}.`,
        `Reassign one or more vessels to alternative available cranes at the same terminal.`
      ));
    }
  });

  return conflicts;
}

// ─── 7. Schedule Overlap ────────────────────────────────────────────────────

/**
 * Detect schedule records where two vessels overlap at the same berth.
 */
function detectScheduleOverlap(schedules) {
  const conflicts = [];

  // Group by berthId
  const byBerth = {};
  schedules.forEach(s => {
    if (!s.berthId) return;
    const key = String(s.berthId._id || s.berthId);
    if (!byBerth[key]) byBerth[key] = [];
    byBerth[key].push(s);
  });

  Object.values(byBerth).forEach(berthSchedules => {
    if (berthSchedules.length < 2) return;

    // Check all pairs for time overlap
    for (let i = 0; i < berthSchedules.length; i++) {
      for (let j = i + 1; j < berthSchedules.length; j++) {
        const a = berthSchedules[i];
        const b = berthSchedules[j];

        // Skip completed/cancelled
        if (['COMPLETED', 'CANCELLED'].includes(a.status) ||
            ['COMPLETED', 'CANCELLED'].includes(b.status)) continue;

        const aStart = new Date(a.plannedArrival);
        const aEnd = new Date(a.plannedDeparture);
        const bStart = new Date(b.plannedArrival);
        const bEnd = new Date(b.plannedDeparture);

        // Overlap check: ranges overlap if aStart < bEnd && bStart < aEnd
        if (aStart < bEnd && bStart < aEnd) {
          const overlapHours = (Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / 3600000;
          const berthInfo = a.berthId?.berthId || String(a.berthId);
          const berthName = a.berthId?.name || berthInfo;

          const vesselA = { vesselId: a.vesselCode, vesselName: a.vesselName, status: a.status, priority: a.priority };
          const vesselB = { vesselId: b.vesselCode, vesselName: b.vesselName, status: b.status, priority: b.priority };

          conflicts.push({
            conflictType: 'SCHEDULE_OVERLAP',
            severity: overlapHours > 6 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
            affectedVessels: [vesselA, vesselB],
            affectedResources: [{
              type: 'BERTH',
              id: berthInfo,
              name: berthName,
              terminalCode: a.terminalCode,
            }],
            explanation: `Vessels ${a.vesselName} and ${b.vesselName} have overlapping schedules at ` +
              `${berthName} (overlap: ${overlapHours.toFixed(1)}h). ` +
              `${a.vesselName}: ${aStart.toISOString().slice(11,16)}–${aEnd.toISOString().slice(11,16)}, ` +
              `${b.vesselName}: ${bStart.toISOString().slice(11,16)}–${bEnd.toISOString().slice(11,16)}.`,
            suggestedResolution: `Reschedule ${b.vesselName} to depart after ${a.vesselName} has cleared ` +
              `${berthName}, or assign one vessel to an alternative berth.`,
          });
        }
      }
    }
  });

  return conflicts;
}

// ─── 8. Terminal Resource Contention ─────────────────────────────────────────

/**
 * Flag terminals where all berths are occupied and vessels are still waiting.
 */
function detectTerminalContention(vessels, berths, terminals) {
  const conflicts = [];

  const terminalMap = {};
  terminals.forEach(t => { terminalMap[t.terminalId] = t; });

  const berthsByTerminal = {};
  berths.forEach(b => {
    if (!berthsByTerminal[b.terminalCode]) berthsByTerminal[b.terminalCode] = [];
    berthsByTerminal[b.terminalCode].push(b);
  });

  const vesselsByTerminal = {};
  vessels.forEach(v => {
    if (!v.terminalCode) return;
    if (!vesselsByTerminal[v.terminalCode]) vesselsByTerminal[v.terminalCode] = [];
    vesselsByTerminal[v.terminalCode].push(v);
  });

  Object.keys(berthsByTerminal).forEach(tc => {
    const tcBerths = berthsByTerminal[tc] || [];
    const tcVessels = vesselsByTerminal[tc] || [];

    const activeBerths = tcBerths.filter(b => b.currentStatus !== 'MAINTENANCE').length;
    const occupiedBerths = tcBerths.filter(b => b.currentStatus === 'OCCUPIED').length;
    const waitingVessels = tcVessels.filter(v => v.status === 'WAITING' || v.status === 'DELAYED');

    if (activeBerths > 0 && occupiedBerths >= activeBerths && waitingVessels.length > 0) {
      const utilPct = Math.round((occupiedBerths / activeBerths) * 100);
      const severity = waitingVessels.length >= 4 ? SEVERITY.CRITICAL :
                       waitingVessels.length >= 2 ? SEVERITY.HIGH : SEVERITY.MEDIUM;

      conflicts.push(makeConflict(
        'TERMINAL_CONTENTION',
        severity,
        waitingVessels.slice(0, 6),
        [{ type: 'TERMINAL', id: tc, name: terminalMap[tc]?.name || tc, terminalCode: tc }],
        `Terminal ${tc} berth utilization is ${utilPct}% (${occupiedBerths}/${activeBerths} berths occupied). ` +
        `${waitingVessels.length} vessel(s) are waiting with no available berth.`,
        `Expedite departure of vessels with the shortest remaining processing time, ` +
        `or divert lower-priority inbound vessels to alternative terminals.`
      ));
    }
  });

  return conflicts;
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Run all conflict detectors and return a deduplicated list.
 *
 * @param {object} data - { vessels, berths, cranes, terminals, schedules }
 * @returns {object[]} all detected conflicts, sorted by severity
 */
function detectAllConflicts(data) {
  const { vessels = [], berths = [], cranes = [], terminals = [], schedules = [] } = data;

  const all = [
    ...detectBerthCompetition(vessels, berths),
    ...detectBerthUnavailability(vessels, berths),
    ...detectBerthSizeIncompatibility(vessels, berths),
    ...detectCraneMaintenanceConflict(vessels, cranes),
    ...detectCraneShortfall(vessels, cranes, terminals),
    ...detectCraneCompetition(vessels, cranes),
    ...detectScheduleOverlap(schedules),
    ...detectTerminalContention(vessels, berths, terminals),
  ];

  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  all.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return all;
}

module.exports = {
  detectAllConflicts,
  detectBerthCompetition,
  detectBerthUnavailability,
  detectBerthSizeIncompatibility,
  detectCraneMaintenanceConflict,
  detectCraneShortfall,
  detectCraneCompetition,
  detectScheduleOverlap,
  detectTerminalContention,
  SEVERITY,
};
