'use strict';

/**
 * PortMind AI — Allocation Scorer
 *
 * Provides explainable, deterministic scoring functions for berth and crane
 * allocation decisions. All scores are normalized to [0, 1].
 *
 * Higher score = better fit.
 */

/** Clamp value to [0, 1]. */
function clamp01(v) {
  return Math.max(0, Math.min(1, isFinite(v) ? v : 0));
}

// ─── BERTH SCORING ────────────────────────────────────────────────────────────

/**
 * BERTH SCORING FACTORS & WEIGHTS
 *
 * berthFit           (0.30) — vessel TEU vs berth max TEU (tighter fit = higher score)
 * availability       (0.25) — AVAILABLE > OCCUPIED (with future free time) >> MAINTENANCE
 * waitingTimeFactor  (0.20) — time until berth is free relative to vessel ETA
 * processingRate     (0.15) — berth processing rate (cranes available)
 * priorityBonus      (0.10) — vessel priority boost
 *
 * Total: 1.00
 */
const BERTH_WEIGHTS = {
  berthFit: 0.30,
  availability: 0.25,
  waitingTime: 0.20,
  processingRate: 0.15,
  priorityBonus: 0.10,
};

/**
 * Score a single berth for a given vessel.
 *
 * @param {object} vessel - Vessel document (lean)
 * @param {object} berth  - Berth document (lean, with availableFrom)
 * @param {Date}   now    - Reference time for waiting time calculation
 * @returns {object} { totalScore, factors, reasons }
 */
function scoreBerthForVessel(vessel, berth, now = new Date()) {
  const reasons = [];

  // ── 1. Berth fit (vessel TEU vs berth capacity) ──────────────────────────
  // A berth that exactly fits the vessel scores highest.
  // Oversized capacity wastes resources; too small = incompatible (score = 0).
  let berthFitFactor = 0;
  const vesselTEU = vessel.sizeTEU || 0;
  const maxTEU = berth.maxVesselSizeTEU || 0;

  if (vesselTEU > maxTEU) {
    // Incompatible: vessel too large
    berthFitFactor = 0;
    reasons.push(`Vessel (${vesselTEU} TEU) exceeds berth capacity (${maxTEU} TEU) — incompatible`);
  } else if (maxTEU === 0) {
    berthFitFactor = 0;
    reasons.push('Berth has no defined TEU capacity');
  } else {
    // Reward tighter fit: ratio of vessel size to berth max (1.0 = perfect fit)
    berthFitFactor = clamp01(vesselTEU / maxTEU);
    reasons.push(`Size fit: ${vesselTEU} TEU vessel vs ${maxTEU} TEU berth capacity (score ${(berthFitFactor * 100).toFixed(0)}%)`);
  }

  // ── 2. Availability ──────────────────────────────────────────────────────
  let availabilityFactor = 0;
  const status = berth.currentStatus;

  if (status === 'AVAILABLE') {
    availabilityFactor = 1.0;
    reasons.push('Berth is currently AVAILABLE');
  } else if (status === 'OCCUPIED') {
    // Berth is occupied but may free up before vessel arrives
    const vesselETA = vessel.arrivalTime ? new Date(vessel.arrivalTime) : now;
    const availableFrom = berth.availableFrom ? new Date(berth.availableFrom) : null;

    if (availableFrom && availableFrom <= vesselETA) {
      // Will be free by the time vessel arrives
      availabilityFactor = 0.7;
      reasons.push(`Berth occupied but will be free before vessel ETA`);
    } else if (availableFrom) {
      // Will be free, but vessel has to wait
      const waitHours = (availableFrom - vesselETA) / 3600000;
      availabilityFactor = clamp01(0.5 - waitHours / 48);
      reasons.push(`Berth occupied, estimated ${waitHours.toFixed(1)}h wait after vessel ETA`);
    } else {
      availabilityFactor = 0.2;
      reasons.push('Berth occupied, availability unknown');
    }
  } else if (status === 'MAINTENANCE' || status === 'RESERVED') {
    availabilityFactor = 0;
    reasons.push(`Berth is ${status} — not available for allocation`);
  }

  // ── 3. Waiting time factor ────────────────────────────────────────────────
  // Inverse of how long the vessel has to wait for this berth.
  // 0 wait = 1.0; 24+ hours = 0.
  let waitingTimeFactor = 1.0;
  const vesselETA2 = vessel.arrivalTime ? new Date(vessel.arrivalTime) : now;

  if (status === 'AVAILABLE') {
    waitingTimeFactor = 1.0;
  } else if (berth.availableFrom) {
    const waitMs = new Date(berth.availableFrom) - vesselETA2;
    if (waitMs <= 0) {
      waitingTimeFactor = 1.0; // free before vessel arrives
    } else {
      const waitHours = waitMs / 3600000;
      waitingTimeFactor = clamp01(1 - waitHours / 24);
    }
  } else {
    waitingTimeFactor = 0.3;
  }

  // ── 4. Processing rate ────────────────────────────────────────────────────
  // Higher processing rate = better throughput for the vessel.
  // Normalize against a practical maximum of 450 TEU/hr.
  const maxRate = 450;
  const processingRateFactor = clamp01((berth.processingRateTEUPerHour || 0) / maxRate);
  reasons.push(`Processing rate: ${berth.processingRateTEUPerHour || 0} TEU/hr`);

  // ── 5. Vessel priority bonus ──────────────────────────────────────────────
  let priorityBonus = 0;
  if (vessel.priority === 'HIGH') { priorityBonus = 1.0; reasons.push('HIGH priority vessel — priority bonus applied'); }
  else if (vessel.priority === 'MEDIUM') { priorityBonus = 0.6; }
  else { priorityBonus = 0.3; }

  // ── Weighted total ────────────────────────────────────────────────────────
  const totalScore = parseFloat((
    BERTH_WEIGHTS.berthFit * berthFitFactor +
    BERTH_WEIGHTS.availability * availabilityFactor +
    BERTH_WEIGHTS.waitingTime * waitingTimeFactor +
    BERTH_WEIGHTS.processingRate * processingRateFactor +
    BERTH_WEIGHTS.priorityBonus * priorityBonus
  ).toFixed(4));

  return {
    totalScore,
    factors: {
      berthFitFactor: parseFloat(berthFitFactor.toFixed(4)),
      availabilityFactor: parseFloat(availabilityFactor.toFixed(4)),
      waitingTimeFactor: parseFloat(waitingTimeFactor.toFixed(4)),
      processingRateFactor: parseFloat(processingRateFactor.toFixed(4)),
      priorityBonus: parseFloat(priorityBonus.toFixed(4)),
    },
    weights: BERTH_WEIGHTS,
    reasons,
    compatible: vesselTEU <= maxTEU && status !== 'MAINTENANCE' && status !== 'RESERVED',
  };
}

// ─── CRANE SCORING ────────────────────────────────────────────────────────────

/**
 * CRANE SCORING FACTORS & WEIGHTS
 *
 * availabilityFactor (0.40) — crane is ACTIVE/IDLE vs MAINTENANCE/BREAKDOWN
 * capacityFit        (0.30) — crane capacity vs vessel TEU requirements
 * utilizationBalance (0.20) — prefer lower-utilization cranes (balance load)
 * priorityBonus      (0.10) — vessel priority
 */
const CRANE_WEIGHTS = {
  availability: 0.40,
  capacityFit: 0.30,
  utilizationBalance: 0.20,
  priorityBonus: 0.10,
};

/**
 * Score a single crane for a given vessel.
 *
 * @param {object} vessel
 * @param {object} crane
 * @returns {object} { totalScore, factors, usable }
 */
function scoreCraneForVessel(vessel, crane) {
  const reasons = [];

  // ── 1. Availability ───────────────────────────────────────────────────────
  let availabilityFactor = 0;
  if (crane.status === 'ACTIVE') {
    availabilityFactor = 1.0;
    reasons.push('Crane is ACTIVE');
  } else if (crane.status === 'IDLE') {
    availabilityFactor = 0.85;
    reasons.push('Crane is IDLE — can be activated');
  } else {
    availabilityFactor = 0;
    reasons.push(`Crane is ${crane.status} — unavailable`);
  }

  // ── 2. Capacity fit ───────────────────────────────────────────────────────
  // Higher lift capacity per hour relative to vessel TEU size = better.
  // Normalize: liftCapacity * estimatedHours / vesselTEU approaching 1 = good fit
  const liftCap = crane.liftCapacityTEUPerHour || 0;
  const vesselTEU = vessel.sizeTEU || 1;
  // Assume ~18h processing; cranes needed = vesselTEU / (18 * liftCap)
  // Capacity fit: how much of the vessel a single crane can process in 18h
  const coverageRatio = Math.min(1, (liftCap * 18) / vesselTEU);
  const capacityFitFactor = clamp01(coverageRatio);
  reasons.push(`Crane capacity: ${liftCap} TEU/hr`);

  // ── 3. Utilization balance ────────────────────────────────────────────────
  // Prefer cranes with lower utilization (spread the load).
  const utilizationBalanceFactor = clamp01(1 - (crane.utilizationPercent || 0) / 100);

  // ── 4. Priority bonus ─────────────────────────────────────────────────────
  let priorityBonus = 0;
  if (vessel.priority === 'HIGH') priorityBonus = 1.0;
  else if (vessel.priority === 'MEDIUM') priorityBonus = 0.5;
  else priorityBonus = 0.2;

  const totalScore = parseFloat((
    CRANE_WEIGHTS.availability * availabilityFactor +
    CRANE_WEIGHTS.capacityFit * capacityFitFactor +
    CRANE_WEIGHTS.utilizationBalance * utilizationBalanceFactor +
    CRANE_WEIGHTS.priorityBonus * priorityBonus
  ).toFixed(4));

  return {
    totalScore,
    factors: {
      availabilityFactor: parseFloat(availabilityFactor.toFixed(4)),
      capacityFitFactor: parseFloat(capacityFitFactor.toFixed(4)),
      utilizationBalanceFactor: parseFloat(utilizationBalanceFactor.toFixed(4)),
      priorityBonus: parseFloat(priorityBonus.toFixed(4)),
    },
    weights: CRANE_WEIGHTS,
    reasons,
    usable: crane.status === 'ACTIVE' || crane.status === 'IDLE',
  };
}

module.exports = {
  scoreBerthForVessel,
  scoreCraneForVessel,
  BERTH_WEIGHTS,
  CRANE_WEIGHTS,
  clamp01,
};
