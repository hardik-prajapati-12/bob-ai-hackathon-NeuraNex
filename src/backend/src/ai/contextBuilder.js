'use strict';

/**
 * PortMind AI — Context Builder
 *
 * Assembles compact operational context from the DB for AI prompt grounding.
 * Context is kept under ~3000 tokens by:
 *   - Selecting only relevant fields
 *   - Capping list sizes
 *   - Using short field names in summaries
 *
 * Three context builders:
 *   buildConversationalContext(query)           — for /api/ai/chat
 *   buildCongestionExplanationContext(code)     — for /api/ai/explain-congestion
 *   buildOperationsPlanContext()                — for /api/ai/operations-plan
 */

const congestionService = require('../services/congestionService');
const optimizationService = require('../services/optimizationService');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Slim-down a congestion assessment to key fields only. */
function slimTerminal(a) {
  return {
    code: a.terminalCode,
    name: a.terminalName,
    status: a.operationalStatus,
    congestionScore: a.congestionScore,
    riskLevel: a.congestionLevel || a.riskLevel,
    berthsOccupied: a.snapshot?.berths?.occupied ?? null,
    berthsActive: a.snapshot?.berths?.active ?? null,
    queuedVessels: a.snapshot?.vessels?.queuedVessels ?? null,
    activeCranes: a.snapshot?.cranes?.active ?? null,
    totalCranes: a.snapshot?.cranes?.total ?? null,
  };
}

/** Slim-down a berth recommendation. */
function slimBerthRec(r) {
  if (!r.hasRecommendation) return null;
  return {
    vessel: r.vessel?.vesselId,
    vesselStatus: r.vessel?.status,
    recommendedBerth: r.bestBerth?.berthId,
    score: r.allocationScore,
    reason: (r.reason || '').slice(0, 120),
  };
}

/** Slim-down a crane recommendation (shortfalls only). */
function slimCraneRec(r) {
  if (!r.hasShortfall) return null;
  return {
    vessel: r.vessel?.vesselId,
    shortage: r.shortage,
    reason: (r.reason || '').slice(0, 120),
  };
}

/** Slim-down a conflict. */
function slimConflict(c) {
  return {
    type: c.type,
    severity: c.severity,
    description: (c.description || '').slice(0, 120),
  };
}

/** Slim-down an alert. */
function slimAlert(a) {
  return {
    type: a.type,
    severity: a.severity,
    terminal: a.terminalCode,
    message: (a.message || '').slice(0, 100),
  };
}

/** Fetch the most recent active/unacknowledged alerts (max 10). */
async function fetchRecentAlerts() {
  try {
    const alerts = await Alert.find({ acknowledged: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return alerts.map(slimAlert);
  } catch (_) {
    return [];
  }
}

// ─── Public Builders ──────────────────────────────────────────────────────────

/**
 * Build context for a conversational chat query.
 * Returns an object with: congestion summary, optimization summary, recent alerts.
 */
async function buildConversationalContext(query) {
  try {
    const [congestionData, optimizationData, alerts] = await Promise.all([
      congestionService.getCurrentCongestion(),
      optimizationService.runFullOptimization(),
      fetchRecentAlerts(),
    ]);

    const terminalSummaries = (congestionData.terminals || []).map(slimTerminal);

    const berthRecs = (optimizationData.berthRecommendations || [])
      .map(slimBerthRec)
      .filter(Boolean)
      .slice(0, 5);

    const craneRecs = (optimizationData.craneRecommendations || [])
      .map(slimCraneRec)
      .filter(Boolean)
      .slice(0, 5);

    const conflicts = (optimizationData.conflicts || [])
      .map(slimConflict)
      .slice(0, 5);

    return {
      timestamp: new Date().toISOString(),
      userQuery: (query || '').slice(0, 300),
      portOverview: {
        overallCongestionScore: congestionData.overallScore,
        overallRiskLevel: congestionData.overallLevel,
        terminals: terminalSummaries,
      },
      optimizationSummary: optimizationData.summary || {},
      berthRecommendations: berthRecs,
      craneShortfalls: craneRecs,
      conflicts,
      recentAlerts: alerts,
      dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
    };
  } catch (err) {
    logger.warn('contextBuilder.buildConversationalContext error', { err: err.message });
    return { error: 'Context unavailable', userQuery: (query || '').slice(0, 300) };
  }
}

/**
 * Build context for congestion explanation.
 * @param {string} terminalCode  e.g. "T1"
 */
async function buildCongestionExplanationContext(terminalCode) {
  try {
    const congestionData = await congestionService.getCurrentCongestion();

    const all = congestionData.terminals || [];
    const target = all.find(
      (t) => t.terminalCode === terminalCode || t.terminalCode === terminalCode?.toUpperCase()
    );

    if (!target) {
      return {
        error: `Terminal ${terminalCode} not found`,
        availableTerminals: all.map((t) => t.terminalCode),
      };
    }

    // Full snapshot for this terminal (not slimmed — needed for explanation)
    const terminalDetail = {
      code: target.terminalCode,
      name: target.terminalName,
      status: target.operationalStatus,
      congestionScore: target.congestionScore,
      riskLevel: target.congestionLevel || target.riskLevel,
      factorBreakdown: target.factorBreakdown || {},
      snapshot: {
        berths: target.snapshot?.berths || {},
        vessels: target.snapshot?.vessels || {},
        cranes: target.snapshot?.cranes || {},
      },
    };

    // Other terminals for comparison
    const otherTerminals = all
      .filter((t) => t.terminalCode !== target.terminalCode)
      .map(slimTerminal);

    // Recent alerts for this terminal
    const alerts = await Alert.find({
      terminalCode,
      acknowledged: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      timestamp: new Date().toISOString(),
      targetTerminal: terminalDetail,
      otherTerminals,
      recentAlerts: alerts.map(slimAlert),
      portOverallScore: congestionData.overallScore,
      portOverallLevel: congestionData.overallLevel,
      dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
    };
  } catch (err) {
    logger.warn('contextBuilder.buildCongestionExplanationContext error', { err: err.message });
    return { error: 'Context unavailable', terminalCode };
  }
}

/**
 * Build context for the 72-hour operations plan.
 * Pulls congestion + full optimization snapshot.
 */
async function buildOperationsPlanContext() {
  try {
    const [congestionData, optimizationData, alerts] = await Promise.all([
      congestionService.getCurrentCongestion(),
      optimizationService.runFullOptimization(),
      fetchRecentAlerts(),
    ]);

    const terminalSummaries = (congestionData.terminals || []).map((t) => ({
      ...slimTerminal(t),
      factorBreakdown: t.factorBreakdown || {},
    }));

    const berthRecs = (optimizationData.berthRecommendations || [])
      .map(slimBerthRec)
      .filter(Boolean)
      .slice(0, 8);

    const craneRecs = (optimizationData.craneRecommendations || [])
      .map(slimCraneRec)
      .filter(Boolean)
      .slice(0, 8);

    const conflicts = (optimizationData.conflicts || [])
      .map(slimConflict)
      .slice(0, 8);

    const resUtil = optimizationData.summary?.resourceUtilization || {};

    return {
      timestamp: new Date().toISOString(),
      planHorizon: '72H',
      portOverview: {
        overallCongestionScore: congestionData.overallScore,
        overallRiskLevel: congestionData.overallLevel,
        terminals: terminalSummaries,
      },
      resourceUtilization: resUtil,
      berthRecommendations: berthRecs,
      craneShortfalls: craneRecs,
      conflicts,
      recentAlerts: alerts,
      dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
    };
  } catch (err) {
    logger.warn('contextBuilder.buildOperationsPlanContext error', { err: err.message });
    return { error: 'Context unavailable' };
  }
}

module.exports = {
  buildConversationalContext,
  buildCongestionExplanationContext,
  buildOperationsPlanContext,
};
