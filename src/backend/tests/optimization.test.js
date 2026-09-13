'use strict';

/**
 * PortMind AI — Optimization Engine Unit Tests
 *
 * Tests the deterministic berth/crane scoring, conflict detection,
 * and the optimization engine — all without a live database.
 */

const { scoreBerthForVessel, scoreCraneForVessel, BERTH_WEIGHTS, CRANE_WEIGHTS, clamp01 } =
  require('../src/optimization/allocationScorer');
const { recommendBerths } = require('../src/optimization/berthOptimizer');
const { recommendCranes } = require('../src/optimization/craneOptimizer');
const {
  detectBerthCompetition,
  detectBerthSizeIncompatibility,
  detectCraneMaintenanceConflict,
  detectCraneShortfall,
  detectCraneCompetition,
  detectScheduleOverlap,
  detectTerminalContention,
  detectAllConflicts,
} = require('../src/optimization/conflictDetector');

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeVessel(overrides = {}) {
  return {
    _id: `v-${Math.random().toString(36).slice(2)}`,
    vesselId: overrides.vesselId || 'V-TEST-1',
    vesselName: overrides.vesselName || 'Test Vessel',
    sizeTEU: 8000,
    status: 'WAITING',
    priority: 'MEDIUM',
    terminalCode: 'T1',
    arrivalTime: new Date(Date.now() + 2 * 3600000), // 2h from now
    congestionRisk: 'MEDIUM',
    requiredCranes: 2,
    assignedBerthId: null,
    assignedCraneIds: [],
    waitingHours: 0,
    ...overrides,
  };
}

function makeBerth(overrides = {}) {
  return {
    _id: `b-${Math.random().toString(36).slice(2)}`,
    berthId: overrides.berthId || 'B1-T1',
    name: overrides.name || 'Berth 1',
    terminalCode: 'T1',
    currentStatus: 'AVAILABLE',
    maxVesselSizeTEU: 14000,
    processingRateTEUPerHour: 350,
    craneCount: 3,
    utilizationPercent: 40,
    availableFrom: null,
    ...overrides,
  };
}

function makeCrane(overrides = {}) {
  return {
    _id: `c-${Math.random().toString(36).slice(2)}`,
    craneId: overrides.craneId || 'C1-T1',
    name: overrides.name || 'Crane 1',
    terminalCode: 'T1',
    type: 'SHIP_TO_SHORE',
    status: 'ACTIVE',
    liftCapacityTEUPerHour: 28,
    utilizationPercent: 60,
    assignedVesselId: null,
    ...overrides,
  };
}

function makeTerminal(overrides = {}) {
  return {
    _id: `t-${Math.random().toString(36).slice(2)}`,
    terminalId: 'T1',
    name: 'Terminal 1',
    maxVesselsSimultaneous: 6,
    activeCranes: 8,
    totalCranes: 10,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOCATION SCORER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('clamp01()', () => {
  it('clamps negative to 0', () => expect(clamp01(-1)).toBe(0));
  it('clamps above 1 to 1', () => expect(clamp01(2)).toBe(1));
  it('passes through 0.5', () => expect(clamp01(0.5)).toBe(0.5));
  it('handles NaN → 0', () => expect(clamp01(NaN)).toBe(0));
});

describe('BERTH_WEIGHTS', () => {
  it('sum to 1.0', () => {
    const sum = Object.values(BERTH_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});

describe('CRANE_WEIGHTS', () => {
  it('sum to 1.0', () => {
    const sum = Object.values(CRANE_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});

describe('scoreBerthForVessel()', () => {
  it('returns a score in [0, 1]', () => {
    const result = scoreBerthForVessel(makeVessel(), makeBerth());
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(1);
  });

  it('available berth scores higher than occupied berth', () => {
    const vessel = makeVessel();
    const avail = makeBerth({ currentStatus: 'AVAILABLE' });
    const occup = makeBerth({ currentStatus: 'OCCUPIED', availableFrom: new Date(Date.now() + 20 * 3600000) });
    expect(scoreBerthForVessel(vessel, avail).totalScore)
      .toBeGreaterThan(scoreBerthForVessel(vessel, occup).totalScore);
  });

  it('maintenance berth is incompatible (compatible = false)', () => {
    const result = scoreBerthForVessel(makeVessel(), makeBerth({ currentStatus: 'MAINTENANCE' }));
    expect(result.compatible).toBe(false);
  });

  it('vessel too large for berth is incompatible', () => {
    const vessel = makeVessel({ sizeTEU: 20000 });
    const berth = makeBerth({ maxVesselSizeTEU: 10000 });
    const result = scoreBerthForVessel(vessel, berth);
    expect(result.compatible).toBe(false);
    expect(result.factors.berthFitFactor).toBe(0);
  });

  it('HIGH priority vessel scores higher than LOW priority', () => {
    const berth = makeBerth();
    const highPri = makeVessel({ priority: 'HIGH' });
    const lowPri = makeVessel({ priority: 'LOW' });
    expect(scoreBerthForVessel(highPri, berth).totalScore)
      .toBeGreaterThan(scoreBerthForVessel(lowPri, berth).totalScore);
  });

  it('factors object contains all required keys', () => {
    const result = scoreBerthForVessel(makeVessel(), makeBerth());
    expect(result.factors).toHaveProperty('berthFitFactor');
    expect(result.factors).toHaveProperty('availabilityFactor');
    expect(result.factors).toHaveProperty('waitingTimeFactor');
    expect(result.factors).toHaveProperty('processingRateFactor');
    expect(result.factors).toHaveProperty('priorityBonus');
  });

  it('higher processing rate berth scores higher', () => {
    const vessel = makeVessel();
    const fast = makeBerth({ processingRateTEUPerHour: 420 });
    const slow = makeBerth({ processingRateTEUPerHour: 200 });
    expect(scoreBerthForVessel(vessel, fast).totalScore)
      .toBeGreaterThan(scoreBerthForVessel(vessel, slow).totalScore);
  });
});

describe('scoreCraneForVessel()', () => {
  it('returns a score in [0, 1]', () => {
    const result = scoreCraneForVessel(makeVessel(), makeCrane());
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(1);
  });

  it('MAINTENANCE crane is not usable', () => {
    const result = scoreCraneForVessel(makeVessel(), makeCrane({ status: 'MAINTENANCE' }));
    expect(result.usable).toBe(false);
    expect(result.factors.availabilityFactor).toBe(0);
  });

  it('BREAKDOWN crane is not usable', () => {
    const result = scoreCraneForVessel(makeVessel(), makeCrane({ status: 'BREAKDOWN' }));
    expect(result.usable).toBe(false);
  });

  it('ACTIVE crane scores higher than IDLE crane', () => {
    const vessel = makeVessel();
    const active = makeCrane({ status: 'ACTIVE' });
    const idle = makeCrane({ status: 'IDLE' });
    expect(scoreCraneForVessel(vessel, active).totalScore)
      .toBeGreaterThan(scoreCraneForVessel(vessel, idle).totalScore);
  });

  it('lower utilization crane scores higher (load balancing)', () => {
    const vessel = makeVessel();
    const low = makeCrane({ utilizationPercent: 20 });
    const high = makeCrane({ utilizationPercent: 90 });
    expect(scoreCraneForVessel(vessel, low).totalScore)
      .toBeGreaterThan(scoreCraneForVessel(vessel, high).totalScore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BERTH OPTIMIZER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('recommendBerths()', () => {
  it('returns one result per vessel', () => {
    const vessels = [makeVessel(), makeVessel({ vesselId: 'V-2' })];
    const berths = [makeBerth()];
    const recs = recommendBerths(vessels, berths);
    expect(recs).toHaveLength(2);
  });

  it('assigns available berth to waiting vessel', () => {
    const vessel = makeVessel({ status: 'WAITING' });
    const berth = makeBerth({ currentStatus: 'AVAILABLE' });
    const recs = recommendBerths([vessel], [berth]);
    expect(recs[0].hasRecommendation).toBe(true);
    expect(recs[0].estimatedWaitingHours).toBe(0);
  });

  it('rejects incompatible berths (vessel too large)', () => {
    const vessel = makeVessel({ sizeTEU: 20000 });
    const berth = makeBerth({ maxVesselSizeTEU: 5000 });
    const recs = recommendBerths([vessel], [berth]);
    expect(recs[0].hasRecommendation).toBe(false);
  });

  it('rejects MAINTENANCE berths', () => {
    const vessel = makeVessel();
    const berth = makeBerth({ currentStatus: 'MAINTENANCE' });
    const recs = recommendBerths([vessel], [berth]);
    expect(recs[0].hasRecommendation).toBe(false);
  });

  it('returns top-3 recommendations when multiple berths available', () => {
    const vessel = makeVessel();
    const berths = [
      makeBerth({ berthId: 'B1', processingRateTEUPerHour: 420 }),
      makeBerth({ berthId: 'B2', processingRateTEUPerHour: 350 }),
      makeBerth({ berthId: 'B3', processingRateTEUPerHour: 280 }),
      makeBerth({ berthId: 'B4', processingRateTEUPerHour: 200 }),
    ];
    const recs = recommendBerths([vessel], berths);
    expect(recs[0].recommendations.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic — same input produces same output', () => {
    const vessels = [makeVessel({ _id: 'fixed-id', vesselId: 'V-100' })];
    const berths = [
      makeBerth({ _id: 'b1', berthId: 'B1', processingRateTEUPerHour: 350 }),
      makeBerth({ _id: 'b2', berthId: 'B2', processingRateTEUPerHour: 400 }),
    ];
    const now = new Date('2026-01-01T12:00:00Z');
    const r1 = recommendBerths(vessels, berths, now);
    const r2 = recommendBerths(vessels, berths, now);
    expect(r1[0].bestBerth?.berthCode).toBe(r2[0].bestBerth?.berthCode);
    expect(r1[0].allocationScore).toBe(r2[0].allocationScore);
  });

  it('handles empty berths list gracefully', () => {
    const vessel = makeVessel();
    const recs = recommendBerths([vessel], []);
    expect(recs[0].hasRecommendation).toBe(false);
    expect(recs[0].reason).toContain('No candidate berths found');
  });

  it('processes DELAYED vessels before INBOUND (urgency ordering)', () => {
    const delayed = makeVessel({ vesselId: 'V-DEL', status: 'DELAYED', priority: 'LOW' });
    const inbound = makeVessel({ vesselId: 'V-INB', status: 'INBOUND', priority: 'HIGH' });
    const berths = [makeBerth()];
    const recs = recommendBerths([inbound, delayed], berths);
    // Delayed vessel should appear first in sorted output
    expect(recs[0].vessel.vesselId).toBe('V-DEL');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRANE OPTIMIZER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('recommendCranes()', () => {
  it('returns one result per vessel', () => {
    const vessels = [makeVessel(), makeVessel({ vesselId: 'V-2' })];
    const cranes = [makeCrane(), makeCrane({ craneId: 'C2' })];
    const recs = recommendCranes(vessels, cranes);
    expect(recs).toHaveLength(2);
  });

  it('excludes MAINTENANCE cranes from allocation', () => {
    const vessel = makeVessel({ requiredCranes: 1 });
    const cranes = [
      makeCrane({ craneId: 'C1', status: 'MAINTENANCE' }),
      makeCrane({ craneId: 'C2', status: 'MAINTENANCE' }),
    ];
    const recs = recommendCranes([vessel], cranes);
    expect(recs[0].hasShortfall).toBe(true);
    expect(recs[0].allocatedCranes.length).toBe(0);
  });

  it('detects crane shortfall correctly', () => {
    const vessel = makeVessel({ requiredCranes: 4 });
    const cranes = [
      makeCrane({ craneId: 'C1' }),
      makeCrane({ craneId: 'C2' }),
    ]; // only 2 available, need 4
    const recs = recommendCranes([vessel], cranes);
    expect(recs[0].shortage).toBe(2);
    expect(recs[0].hasShortfall).toBe(true);
  });

  it('allocates exact number when sufficient cranes available', () => {
    const vessel = makeVessel({ requiredCranes: 2 });
    const cranes = [
      makeCrane({ craneId: 'C1' }),
      makeCrane({ craneId: 'C2' }),
      makeCrane({ craneId: 'C3' }),
    ];
    const recs = recommendCranes([vessel], cranes);
    expect(recs[0].allocatedCranes.length).toBe(2);
    expect(recs[0].shortage).toBe(0);
  });

  it('does not double-assign the same crane to two vessels', () => {
    const v1 = makeVessel({ vesselId: 'V-1', status: 'WAITING', priority: 'HIGH', requiredCranes: 2 });
    const v2 = makeVessel({ vesselId: 'V-2', status: 'WAITING', priority: 'LOW', requiredCranes: 2 });
    const cranes = [
      makeCrane({ craneId: 'C1' }),
      makeCrane({ craneId: 'C2' }),
      makeCrane({ craneId: 'C3' }),
    ];
    const recs = recommendCranes([v1, v2], cranes);
    const allAllocated = recs.flatMap(r => r.allocatedCranes.map(c => c.craneCode));
    const unique = new Set(allAllocated);
    expect(allAllocated.length).toBe(unique.size);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT DETECTOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('detectBerthCompetition()', () => {
  it('detects when more vessels waiting than available berths', () => {
    const vessels = [
      makeVessel({ vesselId: 'V-1', status: 'WAITING', terminalCode: 'T2' }),
      makeVessel({ vesselId: 'V-2', status: 'WAITING', terminalCode: 'T2' }),
      makeVessel({ vesselId: 'V-3', status: 'WAITING', terminalCode: 'T2' }),
    ];
    const berths = [
      makeBerth({ berthId: 'B1', terminalCode: 'T2', currentStatus: 'AVAILABLE' }),
      // only 1 available berth, 3 vessels waiting
    ];
    const conflicts = detectBerthCompetition(vessels, berths);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('BERTH_COMPETITION');
  });

  it('no conflict when berths >= competing vessels', () => {
    const vessels = [makeVessel({ status: 'WAITING' })];
    const berths = [
      makeBerth({ berthId: 'B1', currentStatus: 'AVAILABLE' }),
      makeBerth({ berthId: 'B2', currentStatus: 'AVAILABLE' }),
    ];
    const conflicts = detectBerthCompetition(vessels, berths);
    expect(conflicts.length).toBe(0);
  });
});

describe('detectBerthSizeIncompatibility()', () => {
  it('detects vessel larger than assigned berth', () => {
    const berthDoc = makeBerth({ maxVesselSizeTEU: 5000 });
    const vessel = makeVessel({
      sizeTEU: 15000,
      assignedBerthId: berthDoc,
    });
    const conflicts = detectBerthSizeIncompatibility([vessel], [berthDoc]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('BERTH_SIZE_INCOMPATIBLE');
    expect(conflicts[0].severity).toBe('CRITICAL');
  });

  it('no conflict when vessel fits the berth', () => {
    const berth = makeBerth({ maxVesselSizeTEU: 14000 });
    const vessel = makeVessel({ sizeTEU: 8000, assignedBerthId: berth });
    expect(detectBerthSizeIncompatibility([vessel], [berth]).length).toBe(0);
  });
});

describe('detectCraneMaintenanceConflict()', () => {
  it('detects vessel assigned to a maintenance crane', () => {
    const crane = makeCrane({ craneId: 'C1', status: 'MAINTENANCE' });
    const vessel = makeVessel({
      status: 'AT_BERTH',
      assignedCraneIds: [crane],
    });
    const conflicts = detectCraneMaintenanceConflict([vessel], [crane]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('CRANE_MAINTENANCE');
  });

  it('no conflict for ACTIVE cranes', () => {
    const crane = makeCrane({ status: 'ACTIVE' });
    const vessel = makeVessel({ status: 'AT_BERTH', assignedCraneIds: [crane] });
    expect(detectCraneMaintenanceConflict([vessel], [crane]).length).toBe(0);
  });
});

describe('detectCraneShortfall()', () => {
  it('detects T3-style crane shortfall', () => {
    const terminal = makeTerminal({ terminalId: 'T3', name: 'Terminal 3' });
    const vessels = [
      makeVessel({ vesselId: 'V-1', status: 'AT_BERTH', terminalCode: 'T3', requiredCranes: 4 }),
      makeVessel({ vesselId: 'V-2', status: 'WAITING', terminalCode: 'T3', requiredCranes: 4 }),
      makeVessel({ vesselId: 'V-3', status: 'WAITING', terminalCode: 'T3', requiredCranes: 3 }),
    ];
    const cranes = [
      makeCrane({ craneId: 'C1', terminalCode: 'T3', status: 'ACTIVE' }),
      makeCrane({ craneId: 'C2', terminalCode: 'T3', status: 'ACTIVE' }),
      makeCrane({ craneId: 'C3', terminalCode: 'T3', status: 'MAINTENANCE' }),
      makeCrane({ craneId: 'C4', terminalCode: 'T3', status: 'MAINTENANCE' }),
    ]; // 2 active, but 11 required
    const conflicts = detectCraneShortfall(vessels, cranes, [terminal]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('CRANE_SHORTFALL');
    expect(['HIGH', 'CRITICAL']).toContain(conflicts[0].severity);
  });
});

describe('detectCraneCompetition()', () => {
  it('detects two vessels assigned to the same crane', () => {
    const crane = makeCrane();
    const v1 = makeVessel({ vesselId: 'V-1', status: 'AT_BERTH', assignedCraneIds: [crane] });
    const v2 = makeVessel({ vesselId: 'V-2', status: 'WAITING', assignedCraneIds: [crane] });
    const conflicts = detectCraneCompetition([v1, v2], [crane]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('CRANE_COMPETITION');
    expect(conflicts[0].affectedVessels.length).toBe(2);
  });
});

describe('detectScheduleOverlap()', () => {
  it('detects two schedules overlapping at the same berth', () => {
    const berth = makeBerth();
    const now = new Date();
    const schedA = {
      _id: 'sch-a', vesselCode: 'V-201', vesselName: 'Thunder Bay', terminalCode: 'T2',
      status: 'ACTIVE', priority: 'HIGH',
      berthId: berth,
      plannedArrival: now,
      plannedDeparture: new Date(now.getTime() + 24 * 3600000),
    };
    const schedB = {
      _id: 'sch-b', vesselCode: 'V-219', vesselName: 'Champion', terminalCode: 'T2',
      status: 'ACTIVE', priority: 'HIGH',
      berthId: berth,
      plannedArrival: new Date(now.getTime() - 1 * 3600000), // 1h earlier
      plannedDeparture: new Date(now.getTime() + 5 * 3600000),  // overlaps with A
    };
    const conflicts = detectScheduleOverlap([schedA, schedB]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('SCHEDULE_OVERLAP');
  });

  it('no conflict when schedules do not overlap', () => {
    const berth = makeBerth();
    const now = new Date();
    const schedA = {
      _id: 'sch-a', vesselCode: 'V-1', vesselName: 'Alpha', terminalCode: 'T1',
      status: 'SCHEDULED', priority: 'MEDIUM', berthId: berth,
      plannedArrival: now,
      plannedDeparture: new Date(now.getTime() + 10 * 3600000),
    };
    const schedB = {
      _id: 'sch-b', vesselCode: 'V-2', vesselName: 'Beta', terminalCode: 'T1',
      status: 'SCHEDULED', priority: 'MEDIUM', berthId: berth,
      plannedArrival: new Date(now.getTime() + 12 * 3600000),
      plannedDeparture: new Date(now.getTime() + 22 * 3600000),
    };
    expect(detectScheduleOverlap([schedA, schedB]).length).toBe(0);
  });
});

describe('detectTerminalContention()', () => {
  it('detects terminal with all berths occupied and vessels waiting', () => {
    const terminal = makeTerminal({ terminalId: 'T3', name: 'Terminal 3' });
    const vessels = [
      makeVessel({ vesselId: 'V-1', status: 'WAITING', terminalCode: 'T3' }),
      makeVessel({ vesselId: 'V-2', status: 'WAITING', terminalCode: 'T3' }),
    ];
    const berths = [
      makeBerth({ berthId: 'B1', terminalCode: 'T3', currentStatus: 'OCCUPIED' }),
      makeBerth({ berthId: 'B2', terminalCode: 'T3', currentStatus: 'OCCUPIED' }),
    ]; // all occupied, vessels waiting
    const conflicts = detectTerminalContention(vessels, berths, [terminal]);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe('TERMINAL_CONTENTION');
  });
});

describe('detectAllConflicts()', () => {
  it('returns an array', () => {
    const result = detectAllConflicts({ vessels: [], berths: [], cranes: [], terminals: [], schedules: [] });
    expect(Array.isArray(result)).toBe(true);
  });

  it('aggregates conflicts from multiple detectors', () => {
    const terminal = makeTerminal({ terminalId: 'T2' });
    const vessels = [
      makeVessel({ vesselId: 'V-1', status: 'WAITING', terminalCode: 'T2' }),
      makeVessel({ vesselId: 'V-2', status: 'WAITING', terminalCode: 'T2' }),
      makeVessel({ vesselId: 'V-3', status: 'WAITING', terminalCode: 'T2' }),
    ];
    const berths = [
      makeBerth({ berthId: 'B1', terminalCode: 'T2', currentStatus: 'OCCUPIED' }),
    ]; // all occupied, 3 waiting
    const result = detectAllConflicts({ vessels, berths, cranes: [], terminals: [terminal], schedules: [] });
    // should detect berth competition AND terminal contention
    expect(result.length).toBeGreaterThan(0);
  });

  it('results are sorted with CRITICAL first', () => {
    const terminal = makeTerminal({ terminalId: 'T3' });
    const vessels = Array.from({ length: 6 }, (_, i) =>
      makeVessel({ vesselId: `V-${i}`, status: 'WAITING', terminalCode: 'T3', requiredCranes: 3 })
    );
    const berths = [
      makeBerth({ berthId: 'B1', terminalCode: 'T3', currentStatus: 'OCCUPIED' }),
    ];
    const cranes = [makeCrane({ craneId: 'C1', terminalCode: 'T3', status: 'MAINTENANCE' })];
    const result = detectAllConflicts({ vessels, berths, cranes, terminals: [terminal], schedules: [] });
    if (result.length >= 2) {
      const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      for (let i = 0; i < result.length - 1; i++) {
        expect(sevOrder[result[i].severity]).toBeLessThanOrEqual(sevOrder[result[i + 1].severity]);
      }
    }
  });
});
