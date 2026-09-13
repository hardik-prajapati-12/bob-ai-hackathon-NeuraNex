'use strict';

/**
 * PortMind AI — Congestion Scorer
 *
 * Deterministic analytical scoring model for container port congestion.
 * All inputs are normalized to [0, 1] before weighting.
 * No LLM or external service is used for numerical calculations.
 *
 * Formula:
 *   congestionScore =
 *     0.30 * berthUtilizationFactor
 *   + 0.25 * vesselQueueFactor
 *   + 0.20 * arrivalRateFactor
 *   + 0.15 * craneShortfallFactor
 *   + 0.10 * largeVesselFactor
 *
 * Risk levels:
 *   score < 0.35  → LOW
 *   score < 0.60  → MEDIUM
 *   score < 0.80  → HIGH
 *   score >= 0.80 → CRITICAL
 */

const WEIGHTS = {
  berthUtilization: 0.30,
  vesselQueue: 0.25,
  arrivalRate: 0.20,
  craneShortfall: 0.15,
  largeVessel: 0.10,
};

/** Map a raw score to a risk level label. */
function scoreToLevel(score) {
  if (score >= 0.80) return 'CRITICAL';
  if (score >= 0.60) return 'HIGH';
  if (score >= 0.35) return 'MEDIUM';
  return 'LOW';
}

/** Clamp a value to [0, 1]. */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Normalize berth utilization to [0, 1].
 * 100% occupied berths = factor 1.0, 0% = 0.
 *
 * @param {number} occupiedBerths - berths with status OCCUPIED
 * @param {number} totalActiveBerths - berths not in MAINTENANCE (AVAILABLE + OCCUPIED)
 * @returns {number} factor in [0, 1]
 */
function calcBerthUtilizationFactor(occupiedBerths, totalActiveBerths) {
  if (!totalActiveBerths || totalActiveBerths <= 0) return 0;
  return clamp01(occupiedBerths / totalActiveBerths);
}

/**
 * Normalize vessel queue pressure to [0, 1].
 * Queue = WAITING + DELAYED vessels at the terminal.
 * Saturates at 10 queued vessels (factor = 1.0).
 *
 * @param {number} queuedVessels - vessels in WAITING or DELAYED status
 * @param {number} maxSimultaneous - terminal's maxVesselsSimultaneous
 * @returns {number} factor in [0, 1]
 */
function calcVesselQueueFactor(queuedVessels, maxSimultaneous) {
  const saturation = Math.max(maxSimultaneous || 6, 1);
  return clamp01(queuedVessels / saturation);
}

/**
 * Normalize arrival rate pressure to [0, 1].
 * Count vessels arriving (status INBOUND) within the prediction window.
 * Saturates at maxSimultaneous inbound vessels.
 *
 * @param {number} inboundVessels - vessels with status INBOUND
 * @param {number} maxSimultaneous - terminal's maxVesselsSimultaneous
 * @returns {number} factor in [0, 1]
 */
function calcArrivalRateFactor(inboundVessels, maxSimultaneous) {
  const saturation = Math.max(maxSimultaneous || 6, 1) * 2;
  return clamp01(inboundVessels / saturation);
}

/**
 * Normalize crane shortfall to [0, 1].
 * Shortfall = required cranes by waiting/at-berth vessels minus available active cranes.
 * If no shortfall, factor = 0. Saturates when shortfall >= totalCranes.
 *
 * @param {number} requiredCranes - total cranes required by active vessels
 * @param {number} activeCranes - cranes with status ACTIVE
 * @param {number} totalCranes - total cranes installed
 * @returns {number} factor in [0, 1]
 */
function calcCraneShortfallFactor(requiredCranes, activeCranes, totalCranes) {
  if (!totalCranes || totalCranes <= 0) return 0;
  const shortfall = Math.max(0, requiredCranes - activeCranes);
  return clamp01(shortfall / Math.max(totalCranes, 1));
}

/**
 * Normalize large-vessel concentration to [0, 1].
 * Large vessel = sizeTEU >= 8000. Ratio of large vessels in the active queue.
 *
 * @param {number} largeVesselCount - vessels >= 8000 TEU in INBOUND, WAITING, AT_BERTH, DELAYED
 * @param {number} totalActiveVessels - all non-DEPARTED vessels at terminal
 * @returns {number} factor in [0, 1]
 */
function calcLargeVesselFactor(largeVesselCount, totalActiveVessels) {
  if (!totalActiveVessels || totalActiveVessels <= 0) return 0;
  return clamp01(largeVesselCount / totalActiveVessels);
}

/**
 * Build the contributing-factor list for explainability.
 * Only factors with a meaningful contribution are included.
 */
function buildContributingFactors(factors) {
  const map = [
    { key: 'HIGH_BERTH_UTILIZATION', factorKey: 'berthUtilizationFactor', threshold: 0.5,
      desc: (v) => `Berth utilization is ${Math.round(v * 100)}% — berths are heavily occupied.` },
    { key: 'HIGH_VESSEL_QUEUE', factorKey: 'vesselQueueFactor', threshold: 0.3,
      desc: (v) => `Vessel queue pressure is ${Math.round(v * 100)}% — multiple vessels waiting for berths.` },
    { key: 'HIGH_ARRIVAL_RATE', factorKey: 'arrivalRateFactor', threshold: 0.3,
      desc: (v) => `Arrival rate factor is ${Math.round(v * 100)}% — significant vessel inflow expected.` },
    { key: 'CRANE_SHORTFALL', factorKey: 'craneShortfallFactor', threshold: 0.2,
      desc: (v) => `Crane shortfall factor is ${Math.round(v * 100)}% — available cranes may be insufficient.` },
    { key: 'LARGE_VESSEL_CONCENTRATION', factorKey: 'largeVesselFactor', threshold: 0.3,
      desc: (v) => `Large-vessel concentration is ${Math.round(v * 100)}% — large vessels extend processing time.` },
  ];

  return map
    .filter((m) => factors[m.factorKey] >= m.threshold)
    .map((m) => ({
      factor: m.key,
      weight: WEIGHTS[m.factorKey.replace('Factor', '')],
      value: parseFloat(factors[m.factorKey].toFixed(4)),
      description: m.desc(factors[m.factorKey]),
    }))
    .sort((a, b) => b.weight * b.value - a.weight * a.value);
}

/**
 * Main scoring function.
 *
 * @param {object} inputs
 * @param {number} inputs.occupiedBerths
 * @param {number} inputs.totalActiveBerths
 * @param {number} inputs.queuedVessels        WAITING + DELAYED
 * @param {number} inputs.inboundVessels       INBOUND
 * @param {number} inputs.maxSimultaneous      terminal.maxVesselsSimultaneous
 * @param {number} inputs.requiredCranes       sum of requiredCranes for AT_BERTH + WAITING vessels
 * @param {number} inputs.activeCranes         terminal.activeCranes
 * @param {number} inputs.totalCranes          terminal.totalCranes
 * @param {number} inputs.largeVesselCount     vessels >= 8000 TEU (active)
 * @param {number} inputs.totalActiveVessels   all non-DEPARTED
 * @returns {object} full scoring result
 */
function score(inputs) {
  const berthUtilizationFactor = calcBerthUtilizationFactor(
    inputs.occupiedBerths,
    inputs.totalActiveBerths
  );
  const vesselQueueFactor = calcVesselQueueFactor(
    inputs.queuedVessels,
    inputs.maxSimultaneous
  );
  const arrivalRateFactor = calcArrivalRateFactor(
    inputs.inboundVessels,
    inputs.maxSimultaneous
  );
  const craneShortfallFactor = calcCraneShortfallFactor(
    inputs.requiredCranes,
    inputs.activeCranes,
    inputs.totalCranes
  );
  const largeVesselFactor = calcLargeVesselFactor(
    inputs.largeVesselCount,
    inputs.totalActiveVessels
  );

  const congestionScore = parseFloat(
    (
      WEIGHTS.berthUtilization * berthUtilizationFactor +
      WEIGHTS.vesselQueue * vesselQueueFactor +
      WEIGHTS.arrivalRate * arrivalRateFactor +
      WEIGHTS.craneShortfall * craneShortfallFactor +
      WEIGHTS.largeVessel * largeVesselFactor
    ).toFixed(4)
  );

  const congestionLevel = scoreToLevel(congestionScore);

  const factorInputs = {
    berthUtilizationFactor: parseFloat(berthUtilizationFactor.toFixed(4)),
    vesselQueueFactor: parseFloat(vesselQueueFactor.toFixed(4)),
    arrivalRateFactor: parseFloat(arrivalRateFactor.toFixed(4)),
    craneShortfallFactor: parseFloat(craneShortfallFactor.toFixed(4)),
    largeVesselFactor: parseFloat(largeVesselFactor.toFixed(4)),
  };

  const contributingFactors = buildContributingFactors(factorInputs);

  return {
    congestionScore,
    congestionLevel,
    factorInputs,
    contributingFactors,
    weights: WEIGHTS,
    modelType: 'ANALYTICAL_SCORING',
    dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
  };
}

module.exports = {
  score,
  scoreToLevel,
  calcBerthUtilizationFactor,
  calcVesselQueueFactor,
  calcArrivalRateFactor,
  calcCraneShortfallFactor,
  calcLargeVesselFactor,
  WEIGHTS,
};
