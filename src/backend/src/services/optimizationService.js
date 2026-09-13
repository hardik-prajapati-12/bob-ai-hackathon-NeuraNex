'use strict';

/**
 * PortMind AI — Optimization Service
 *
 * Orchestrates the berth optimizer, crane optimizer, and conflict detector
 * to produce a complete operational optimization result for a terminal or
 * the entire port.
 *
 * Data loading strategy:
 * — All relevant DB data is fetched ONCE at the start of each operation
 *   and passed down to pure algorithmic functions (no repeated DB calls).
 */

const mongoose = require('mongoose');
const Terminal  = require('../models/Terminal');
const Vessel    = require('../models/Vessel');
const Berth     = require('../models/Berth');
const Crane     = require('../models/Crane');
const Schedule  = require('../models/Schedule');
const Recommendation = require('../models/Recommendation');

const { recommendBerths }      = require('../optimization/berthOptimizer');
const { recommendCranes }      = require('../optimization/craneOptimizer');
const { detectAllConflicts }   = require('../optimization/conflictDetector');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve terminal by code (e.g. "T1") or ObjectId. Returns null if not found. */
async function resolveTerminal(id) {
  if (!id) return null;
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { terminalId: id };
  return Terminal.findOne(query).lean();
}

/** Convert priority label to numeric weight for benefit calculation. */
function priorityWeight(p) {
  return p === 'HIGH' ? 1.0 : p === 'MEDIUM' ? 0.6 : 0.3;
}

/** Estimate hours saved from a berth recommendation vs current waiting hours. */
function estimateBenefitHours(rec) {
  const currentWait = rec.vessel.waitingHours || 0;
  const projectedWait = rec.estimatedWaitingHours || 0;
  return Math.max(0, parseFloat((currentWait - projectedWait).toFixed(2)));
}

/**
 * Persist meaningful recommendations to the DB.
 * Deduplicates by vessel + type: if a PENDING recommendation already exists
 * for the same vessel and type (generated within the last hour), skip.
 */
async function persistRecommendations(berthRecs, craneRecs) {
  const saved = [];
  const now = new Date();
  const oneHourAgo = new Date(now - 3600000);

  for (const rec of berthRecs) {
    if (!rec.hasRecommendation || !rec.bestBerth) continue;

    // Check for recent duplicate
    const existing = await Recommendation.findOne({
      type: 'BERTH_REALLOCATION',
      vesselId: rec.vessel._id,
      status: 'PENDING',
      generatedAt: { $gte: oneHourAgo },
    }).lean();

    if (existing) continue;

    const benefitHours = estimateBenefitHours(rec);
    const rid = `REC-B-${rec.vessel.vesselId}-${Date.now()}`;

    try {
      const doc = await Recommendation.create({
        recommendationId: rid,
        type: 'BERTH_REALLOCATION',
        terminalCode: rec.bestBerth.terminalCode,
        vesselId: rec.vessel._id,
        vesselCode: rec.vessel.vesselId,
        recommendedBerthId: rec.bestBerth.berthId,
        reason: rec.reason.slice(0, 500),
        expectedBenefitHours: benefitHours,
        expectedBenefitDescription: benefitHours > 0
          ? `Reduces waiting time by ~${benefitHours.toFixed(1)} hours`
          : 'Assigns vessel to optimal available berth',
        priority: rec.vessel.priority || 'MEDIUM',
        confidence: parseFloat(Math.min(1, rec.allocationScore).toFixed(2)),
        status: 'PENDING',
        isDemoData: true,
      });
      saved.push(doc);
    } catch (_) {
      // duplicate key or validation error — skip silently
    }
  }

  for (const rec of craneRecs) {
    if (!rec.hasShortfall) continue; // only persist shortfalls as recommendations

    const existing = await Recommendation.findOne({
      type: 'CRANE_ADDITION',
      vesselId: rec.vessel._id,
      status: 'PENDING',
      generatedAt: { $gte: oneHourAgo },
    }).lean();

    if (existing) continue;

    const rid = `REC-C-${rec.vessel.vesselId}-${Date.now()}`;

    try {
      await Recommendation.create({
        recommendationId: rid,
        type: 'CRANE_ADDITION',
        terminalCode: rec.vessel.terminalCode,
        vesselId: rec.vessel._id,
        vesselCode: rec.vessel.vesselId,
        reason: rec.reason.slice(0, 500),
        expectedBenefitHours: rec.shortage * 2, // rough estimate
        expectedBenefitDescription: `Resolving crane shortfall of ${rec.shortage} would reduce processing delay`,
        priority: rec.shortage >= 3 ? 'CRITICAL' : rec.shortage >= 2 ? 'HIGH' : 'MEDIUM',
        confidence: 0.80,
        status: 'PENDING',
        isDemoData: true,
      });
    } catch (_) {
      // skip duplicates
    }
  }

  return saved;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load all operational data needed for optimization in one DB round-trip.
 * @param {string|null} terminalCode - optional filter; null = all terminals
 */
async function loadOperationalSnapshot(terminalCode = null) {
  const vesselFilter = {
    status: { $in: ['AT_BERTH', 'WAITING', 'INBOUND', 'DELAYED'] },
  };
  const berthFilter = {};
  const craneFilter = {};
  const scheduleFilter = {
    status: { $in: ['SCHEDULED', 'ACTIVE', 'DELAYED'] },
    plannedArrival: { $gte: new Date(Date.now() - 48 * 3600000) }, // ±48h window
    plannedDeparture: { $lte: new Date(Date.now() + 96 * 3600000) },
  };

  if (terminalCode) {
    vesselFilter.terminalCode = terminalCode;
    berthFilter.terminalCode  = terminalCode;
    craneFilter.terminalCode  = terminalCode;
    scheduleFilter.terminalCode = terminalCode;
  }

  const [vessels, berths, cranes, terminals, schedules] = await Promise.all([
    Vessel.find(vesselFilter).lean(),
    Berth.find(berthFilter).lean(),
    Crane.find(craneFilter).lean(),
    Terminal.find().lean(),
    Schedule.find(scheduleFilter)
      .populate('berthId', 'berthId name')
      .lean(),
  ]);

  return { vessels, berths, cranes, terminals, schedules };
}

/**
 * GET /api/optimization/berths
 * Returns berth recommendations for all vessels needing allocation.
 */
async function getBerthRecommendations(terminalCode = null) {
  const { vessels, berths } = await loadOperationalSnapshot(terminalCode);

  // Vessels that need berth allocation: WAITING, DELAYED, or INBOUND without a berth
  const needsBerth = vessels.filter(v =>
    ['WAITING', 'DELAYED'].includes(v.status) ||
    (v.status === 'INBOUND' && !v.assignedBerthId)
  );

  const recommendations = recommendBerths(needsBerth, berths);
  return recommendations;
}

/**
 * GET /api/optimization/cranes
 * Returns crane allocation recommendations for active vessels.
 */
async function getCraneRecommendations(terminalCode = null) {
  const { vessels, cranes } = await loadOperationalSnapshot(terminalCode);

  // Include AT_BERTH, WAITING, DELAYED vessels
  const needsCranes = vessels.filter(v =>
    ['AT_BERTH', 'WAITING', 'DELAYED'].includes(v.status)
  );

  return recommendCranes(needsCranes, cranes);
}

/**
 * GET /api/optimization/conflicts
 * Returns all detected operational conflicts.
 */
async function getConflicts(terminalCode = null) {
  const snapshot = await loadOperationalSnapshot(terminalCode);
  return detectAllConflicts(snapshot);
}

/**
 * POST /api/optimization/optimize
 * Full optimization pass: berths + cranes + conflicts + resource summary.
 * Optionally filters to a single terminal.
 * Persists meaningful recommendations to DB.
 */
async function runFullOptimization(terminalCode = null) {
  const snapshot = await loadOperationalSnapshot(terminalCode);
  const { vessels, berths, cranes, terminals, schedules } = snapshot;

  // Vessels needing berth
  const needsBerth = vessels.filter(v =>
    ['WAITING', 'DELAYED'].includes(v.status) ||
    (v.status === 'INBOUND' && !v.assignedBerthId)
  );

  // Vessels needing cranes
  const needsCranes = vessels.filter(v =>
    ['AT_BERTH', 'WAITING', 'DELAYED'].includes(v.status)
  );

  const [berthRecs, craneRecs, conflicts] = await Promise.all([
    Promise.resolve(recommendBerths(needsBerth, berths)),
    Promise.resolve(recommendCranes(needsCranes, cranes)),
    Promise.resolve(detectAllConflicts(snapshot)),
  ]);

  // Persist recommendations (non-blocking: don't fail the response if it errors)
  persistRecommendations(berthRecs, craneRecs).catch(() => {});

  // Resource utilization summary
  const availableBerths  = berths.filter(b => b.currentStatus === 'AVAILABLE').length;
  const occupiedBerths   = berths.filter(b => b.currentStatus === 'OCCUPIED').length;
  const maintenanceBerths = berths.filter(b => b.currentStatus === 'MAINTENANCE').length;
  const activeCranes     = cranes.filter(c => c.status === 'ACTIVE' || c.status === 'IDLE').length;
  const inactiveCranes   = cranes.filter(c => c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN').length;
  const waitingVessels   = vessels.filter(v => v.status === 'WAITING' || v.status === 'DELAYED').length;
  const atBerthVessels   = vessels.filter(v => v.status === 'AT_BERTH').length;
  const inboundVessels   = vessels.filter(v => v.status === 'INBOUND').length;

  // Estimated total hours saved from berth recommendations
  const totalHoursSaved = berthRecs.reduce((sum, r) => sum + estimateBenefitHours(r), 0);

  // Conflict severity counts
  const conflictSeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  conflicts.forEach(c => { conflictSeverity[c.severity] = (conflictSeverity[c.severity] || 0) + 1; });

  const summary = {
    terminalCode: terminalCode || 'ALL',
    generatedAt: new Date().toISOString(),
    resourceUtilization: {
      totalBerths: berths.length,
      availableBerths,
      occupiedBerths,
      maintenanceBerths,
      berthUtilizationPercent: berths.length > 0
        ? Math.round((occupiedBerths / (berths.length - maintenanceBerths || 1)) * 100)
        : 0,
      totalCranes: cranes.length,
      activeCranes,
      inactiveCranes,
      craneAvailabilityPercent: cranes.length > 0
        ? Math.round((activeCranes / cranes.length) * 100)
        : 0,
      waitingVessels,
      atBerthVessels,
      inboundVessels,
      totalActiveVessels: vessels.length,
    },
    berthRecommendations: berthRecs.length,
    berthRecommendationsWithMatch: berthRecs.filter(r => r.hasRecommendation).length,
    craneRecommendations: craneRecs.length,
    craneShortfalls: craneRecs.filter(r => r.hasShortfall).length,
    conflictsDetected: conflicts.length,
    conflictSeverity,
    estimatedHoursSaved: parseFloat(totalHoursSaved.toFixed(2)),
    dataLabel: 'DETERMINISTIC OPTIMIZATION — DEMO DATA',
  };

  return {
    summary,
    berthRecommendations: berthRecs,
    craneRecommendations: craneRecs,
    conflicts,
  };
}

/**
 * GET /api/optimization/recommendations
 * Returns persisted recommendation records.
 */
async function getStoredRecommendations({ terminalCode, type, status, limit = 20 } = {}) {
  const filter = {};
  if (terminalCode) filter.terminalCode = terminalCode;
  if (type) filter.type = type;
  if (status) filter.status = status;

  return Recommendation.find(filter)
    .sort({ generatedAt: -1 })
    .limit(Math.min(100, limit))
    .populate('vesselId', 'vesselId vesselName sizeTEU status congestionRisk')
    .populate('recommendedBerthId', 'berthId name currentStatus')
    .lean();
}

module.exports = {
  getBerthRecommendations,
  getCraneRecommendations,
  getConflicts,
  runFullOptimization,
  getStoredRecommendations,
  loadOperationalSnapshot,
};
