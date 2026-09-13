'use strict';

/**
 * PortMind AI — Optimization Controller
 * HTTP layer for /api/optimization/* endpoints.
 */

const { query, body } = require('express-validator');
const svc = require('../services/optimizationService');
const { success, notFound, badRequest } = require('../utils/apiResponse');

// ─── Validators ───────────────────────────────────────────────────────────────

const terminalCodeValidator = [
  query('terminalCode').optional().isString().trim().notEmpty(),
];

const optimizeValidators = [
  body('terminalCode').optional().isString().trim().notEmpty(),
];

const recsValidators = [
  query('terminalCode').optional().isString().trim().notEmpty(),
  query('type').optional().isIn([
    'BERTH_REALLOCATION', 'CRANE_REASSIGNMENT', 'VESSEL_DELAY',
    'REROUTING', 'CRANE_ADDITION', 'SCHEDULE_ADJUSTMENT',
  ]),
  query('status').optional().isIn(['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/optimization/berths?terminalCode=T1
 * Berth recommendations for vessels needing allocation.
 */
async function berths(req, res, next) {
  try {
    const { terminalCode } = req.query;
    const data = await svc.getBerthRecommendations(terminalCode || null);
    return success(res, data, `${data.length} berth recommendation(s)`);
  } catch (err) { next(err); }
}

/**
 * GET /api/optimization/cranes?terminalCode=T1
 * Crane allocation recommendations.
 */
async function cranes(req, res, next) {
  try {
    const { terminalCode } = req.query;
    const data = await svc.getCraneRecommendations(terminalCode || null);
    return success(res, data, `${data.length} crane allocation(s)`);
  } catch (err) { next(err); }
}

/**
 * GET /api/optimization/conflicts?terminalCode=T1
 * Detected operational conflicts.
 */
async function conflicts(req, res, next) {
  try {
    const { terminalCode } = req.query;
    const data = await svc.getConflicts(terminalCode || null);
    return success(res, data, `${data.length} conflict(s) detected`);
  } catch (err) { next(err); }
}

/**
 * POST /api/optimization/optimize
 * Body: { terminalCode? }
 * Full optimization pass: berths + cranes + conflicts + summary.
 */
async function optimize(req, res, next) {
  try {
    const terminalCode = req.body?.terminalCode || null;
    const data = await svc.runFullOptimization(terminalCode);
    return success(res, data, 'Optimization complete');
  } catch (err) { next(err); }
}

/**
 * GET /api/optimization/recommendations
 * Stored recommendation records.
 */
async function recommendations(req, res, next) {
  try {
    const { terminalCode, type, status } = req.query;
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await svc.getStoredRecommendations({ terminalCode, type, status, limit });
    return success(res, data, `${data.length} recommendation(s)`);
  } catch (err) { next(err); }
}

module.exports = {
  berths,
  cranes,
  conflicts,
  optimize,
  recommendations,
  terminalCodeValidator,
  optimizeValidators,
  recsValidators,
};
