'use strict';

/**
 * PortMind AI — Congestion Service
 *
 * Orchestrates the analytics engine to provide congestion data:
 *  - Current congestion state (live from DB)
 *  - Stored predictions (from congestionPredictions collection)
 *  - Trigger new prediction and persist it
 *  - Historical congestion trend data
 */

const mongoose = require('mongoose');
const Terminal = require('../models/Terminal');
const CongestionPrediction = require('../models/CongestionPrediction');
const scorer = require('../analytics/congestionScorer');
const utilizationCalc = require('../analytics/utilizationCalculator');
const forecastEngine = require('../analytics/forecastEngine');
const historicalAnalyzer = require('../analytics/historicalAnalyzer');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve terminal by terminalCode (e.g. "T1") or MongoDB ObjectId string.
 * Returns null if not found.
 */
async function resolveTerminal(id) {
  if (!id) return null;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { terminalId: id };
  return Terminal.findOne(query).lean();
}

/**
 * Build the congestion assessment for a single terminal from live DB data.
 * Returns the scorer result enriched with context about the terminal.
 */
async function assessTerminal(terminal) {
  const snapshot = await utilizationCalc.getTerminalUtilizationSnapshot(terminal);

  const scorerInput = {
    occupiedBerths: snapshot.berths.occupied,
    totalActiveBerths: snapshot.berths.active,
    queuedVessels: snapshot.vessels.queuedVessels,
    inboundVessels: snapshot.vessels.inbound,
    maxSimultaneous: terminal.maxVesselsSimultaneous || 6,
    requiredCranes: snapshot.vessels.requiredCranes,
    activeCranes: snapshot.cranes.active,
    totalCranes: snapshot.cranes.total,
    largeVesselCount: snapshot.vessels.largeVesselCount,
    totalActiveVessels: Math.max(1, snapshot.vessels.totalActive),
  };

  const scorerResult = scorer.score(scorerInput);

  return {
    terminalId: terminal._id,
    terminalCode: terminal.terminalId,
    terminalName: terminal.name,
    operationalStatus: terminal.operationalStatus,
    snapshot,
    ...scorerResult,
    assessedAt: new Date().toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * GET /api/congestion/current
 * Returns live congestion assessment for every terminal.
 */
async function getCurrentCongestion() {
  const terminals = await Terminal.find().lean();

  const assessments = await Promise.all(
    terminals.map((t) => assessTerminal(t))
  );

  // Overall port congestion = highest individual terminal score
  const overallScore = assessments.reduce(
    (max, a) => Math.max(max, a.congestionScore),
    0
  );

  return {
    overallScore: parseFloat(overallScore.toFixed(4)),
    overallLevel: scorer.scoreToLevel(overallScore),
    terminals: assessments,
    generatedAt: new Date().toISOString(),
    dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
  };
}

/**
 * GET /api/congestion/predictions
 * Returns most recent stored predictions.
 * Accepts optional filters: terminalCode, horizon.
 */
async function getStoredPredictions({ terminalCode, horizon, limit = 20 } = {}) {
  const filter = {};
  if (terminalCode) filter.terminalCode = terminalCode;
  if (horizon) filter.horizon = horizon;

  const predictions = await CongestionPrediction.find(filter)
    .sort({ generatedAt: -1 })
    .limit(Math.min(100, limit))
    .lean();

  return predictions;
}

/**
 * POST /api/congestion/predict
 * Calculates a new deterministic prediction for a terminal/horizon and persists it.
 *
 * @param {string} terminalId - terminal code (e.g. "T1") or ObjectId
 * @param {string} horizon - '6H' | '12H' | '24H' | '72H'
 */
async function runPrediction(terminalId, horizon) {
  const terminal = await resolveTerminal(terminalId);
  if (!terminal) {
    const err = new Error(`Terminal '${terminalId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const snapshot = await utilizationCalc.getTerminalUtilizationSnapshot(terminal);
  const forecast = await forecastEngine.forecastForHorizon(snapshot, horizon);

  // Derive a unique predictionId
  const timestamp = Date.now();
  const predictionId = `PRED-${terminal.terminalId}-${horizon}-${timestamp}`;

  // validUntil = now + horizon
  const horizonHours = forecastEngine.HORIZON_HOURS[horizon] || 24;
  const validUntil = new Date(Date.now() + horizonHours * 3600 * 1000);

  const doc = await CongestionPrediction.create({
    predictionId,
    terminalId: terminal._id,
    terminalCode: terminal.terminalId,
    terminalName: terminal.name,
    horizon,
    generatedAt: new Date(),
    validUntil,
    congestionScore: forecast.congestionScore,
    riskLevel: forecast.congestionLevel,
    predictedWaitingHours: forecast.predictedWaitingHours,
    berthUtilizationForecast: forecast.berthUtilizationForecast,
    vesselQueueForecast: forecast.vesselQueueForecast,
    factorInputs: forecast.factorInputs,
    contributingFactors: forecast.contributingFactors,
    modelType: 'ANALYTICAL_SCORING',
    confidence: forecast.confidence,
    isDemoData: true,
  });

  return doc.toObject();
}

/**
 * GET /api/congestion/history
 * Returns historical congestion trend data.
 * Accepts optional: terminalCode, days.
 */
async function getCongestionHistory({ terminalCode, days = 30 } = {}) {
  const [series, summary] = await Promise.all([
    historicalAnalyzer.getDailyCongestionSeries({ terminalCode, days }),
    terminalCode
      ? historicalAnalyzer.getTerminalHistorySummary(terminalCode, days)
      : Promise.resolve(null),
  ]);

  return { ...series, summary };
}

module.exports = {
  getCurrentCongestion,
  getStoredPredictions,
  runPrediction,
  getCongestionHistory,
  assessTerminal,
  resolveTerminal,
};
