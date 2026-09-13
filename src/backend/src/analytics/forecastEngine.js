'use strict';

/**
 * PortMind AI — Forecast Engine
 *
 * Produces deterministic congestion forecasts for future time horizons
 * using existing schedule data and current terminal state.
 *
 * Supported horizons: 6H, 12H, 24H, 72H
 *
 * IMPORTANT: This is an analytical scoring model, NOT a trained ML model.
 * Forecasts are labelled accordingly in all responses.
 */

const Schedule = require('../models/Schedule');
const scorer = require('./congestionScorer');

const HORIZON_HOURS = {
  '6H': 6,
  '12H': 12,
  '24H': 24,
  '72H': 72,
};

/**
 * Count scheduled vessel arrivals in the forecast window.
 *
 * @param {mongoose.Types.ObjectId} terminalId
 * @param {Date} from - window start
 * @param {Date} to - window end
 * @returns {object} arrival stats from schedules
 */
async function getScheduledArrivalsInWindow(terminalId, from, to) {
  const schedules = await Schedule.find({
    terminalId,
    plannedArrival: { $gte: from, $lte: to },
    status: { $in: ['SCHEDULED', 'ACTIVE', 'DELAYED'] },
  })
    .populate('vesselId', 'sizeTEU requiredCranes')
    .lean();

  const count = schedules.length;
  const largeVessels = schedules.filter(
    (s) => (s.vesselId?.sizeTEU || 0) >= 8000
  ).length;
  const totalRequiredCranes = schedules.reduce(
    (sum, s) => sum + (s.requiredCranes || s.vesselId?.requiredCranes || 2),
    0
  );

  return { count, largeVessels, totalRequiredCranes };
}

/**
 * Produce a deterministic congestion forecast for one terminal at one horizon.
 *
 * The forecast adjusts the current-state score by layering in:
 * 1. Scheduled future arrivals within the horizon window
 * 2. A decay factor for AT_BERTH vessels (they will depart)
 * 3. Crane availability projection (maintenance schedule not available → use current state)
 *
 * @param {object} snapshot - utilization snapshot from utilizationCalculator
 * @param {string} horizon - '6H' | '12H' | '24H' | '72H'
 * @returns {object} forecast result
 */
async function forecastForHorizon(snapshot, horizon) {
  const horizonHours = HORIZON_HOURS[horizon] || 24;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + horizonHours * 3600 * 1000);

  // Get scheduled arrivals in the horizon window
  const scheduledArrivals = await getScheduledArrivalsInWindow(
    snapshot.terminalId,
    now,
    windowEnd
  );

  // Estimate how many AT_BERTH vessels will have departed in this window.
  // Assume an average processing time of ~18 hours per vessel.
  // For longer horizons, more vessels will cycle through.
  const avgProcessingHours = 18;
  const departureRatio = Math.min(1, horizonHours / avgProcessingHours);
  const estimatedDepartures = Math.floor(snapshot.vessels.atBerth * departureRatio);

  // Projected queue = current queue + scheduled inbound arrivals - estimated departures
  const projectedQueue = Math.max(
    0,
    snapshot.vessels.queuedVessels +
      scheduledArrivals.count -
      estimatedDepartures
  );

  // Projected inbound in horizon
  const projectedInbound = scheduledArrivals.count;

  // Projected crane demand from scheduled + current queue
  const projectedRequiredCranes =
    snapshot.vessels.requiredCranes + scheduledArrivals.totalRequiredCranes;

  // Projected large-vessel count (current active + arriving large vessels)
  const projectedLargeVessels =
    snapshot.vessels.largeVesselCount + scheduledArrivals.largeVessels;
  const projectedTotalActive =
    snapshot.vessels.totalActive + scheduledArrivals.count;

  // Berth utilization does not change drastically in the short term (berths cycle slowly)
  const projectedOccupiedBerths = Math.min(
    snapshot.berths.active,
    snapshot.berths.occupied +
      Math.max(0, projectedQueue - snapshot.berths.available)
  );

  const result = scorer.score({
    occupiedBerths: projectedOccupiedBerths,
    totalActiveBerths: snapshot.berths.active,
    queuedVessels: projectedQueue,
    inboundVessels: projectedInbound,
    maxSimultaneous: snapshot.vessels.totalActive + scheduledArrivals.count > 0
      ? Math.max(6, snapshot.berths.active)
      : 6,
    requiredCranes: projectedRequiredCranes,
    activeCranes: snapshot.cranes.active,
    totalCranes: snapshot.cranes.total,
    largeVesselCount: projectedLargeVessels,
    totalActiveVessels: Math.max(1, projectedTotalActive),
  });

  // Predicted waiting hours scale with congestion score and horizon
  const baseWaitHours = 4;
  const predictedWaitingHours = parseFloat(
    (baseWaitHours * (1 + result.congestionScore * horizonHours / 12)).toFixed(1)
  );

  // Confidence degrades with horizon distance (further = less reliable)
  const confidence = parseFloat(
    Math.max(0.40, 0.88 - (horizonHours / 72) * 0.35).toFixed(2)
  );

  return {
    horizon,
    horizonHours,
    congestionScore: result.congestionScore,
    congestionLevel: result.congestionLevel,
    predictedWaitingHours,
    berthUtilizationForecast: parseFloat(
      (projectedOccupiedBerths / Math.max(1, snapshot.berths.active)).toFixed(4)
    ),
    vesselQueueForecast: projectedQueue,
    scheduledArrivals: scheduledArrivals.count,
    estimatedDepartures,
    factorInputs: result.factorInputs,
    contributingFactors: result.contributingFactors,
    confidence,
    modelType: 'ANALYTICAL_SCORING',
    dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
  };
}

/**
 * Produce forecasts for all supported horizons for a terminal.
 *
 * @param {object} snapshot - utilization snapshot
 * @returns {Promise<object[]>} array of forecasts keyed by horizon
 */
async function forecastAllHorizons(snapshot) {
  const horizons = Object.keys(HORIZON_HOURS);
  const results = await Promise.all(
    horizons.map((h) => forecastForHorizon(snapshot, h))
  );
  return results;
}

module.exports = {
  forecastForHorizon,
  forecastAllHorizons,
  HORIZON_HOURS,
};
