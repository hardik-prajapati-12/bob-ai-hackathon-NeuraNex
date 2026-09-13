'use strict';

/**
 * PortMind AI — Congestion Controller
 * Handles HTTP layer for all /api/congestion/* endpoints.
 */

const { query, body } = require('express-validator');
const congestionService = require('../services/congestionService');
const { success, notFound, badRequest } = require('../utils/apiResponse');

// ─── Validators ───────────────────────────────────────────────────────────────

const predictionsValidators = [
  query('terminalCode').optional().isString().trim().notEmpty(),
  query('horizon').optional().isIn(['6H', '12H', '24H', '72H']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const predictValidators = [
  body('terminalId')
    .exists({ checkFalsy: true })
    .withMessage('terminalId is required')
    .isString()
    .trim()
    .notEmpty(),
  body('horizon')
    .exists({ checkFalsy: true })
    .withMessage('horizon is required')
    .isIn(['6H', '12H', '24H', '72H'])
    .withMessage('horizon must be one of: 6H, 12H, 24H, 72H'),
];

const historyValidators = [
  query('terminalCode').optional().isString().trim().notEmpty(),
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('days must be between 1 and 365'),
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/congestion/current
 * Live congestion assessment from the analytical engine.
 */
async function current(req, res, next) {
  try {
    const data = await congestionService.getCurrentCongestion();
    return success(res, data, 'Current congestion assessment');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/congestion/predictions
 * Returns stored prediction records.
 * Query params: terminalCode, horizon, limit
 */
async function predictions(req, res, next) {
  try {
    const { terminalCode, horizon } = req.query;
    const limit = parseInt(req.query.limit, 10) || 20;

    const data = await congestionService.getStoredPredictions({
      terminalCode,
      horizon,
      limit,
    });

    return success(res, data, `${data.length} prediction record(s) found`);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/congestion/predict
 * Body: { terminalId, horizon }
 * Runs a fresh deterministic prediction and persists it.
 */
async function predict(req, res, next) {
  try {
    const { terminalId, horizon } = req.body;

    const data = await congestionService.runPrediction(terminalId, horizon);
    return success(res, data, `Prediction generated for ${terminalId} @ ${horizon}`);
  } catch (err) {
    if (err.statusCode === 404) return notFound(res, err.message);
    next(err);
  }
}

/**
 * GET /api/congestion/history
 * Query params: terminalCode (optional), days (optional, default 30)
 */
async function history(req, res, next) {
  try {
    const { terminalCode } = req.query;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    const data = await congestionService.getCongestionHistory({ terminalCode, days });
    return success(res, data, 'Historical congestion data');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  current,
  predictions,
  predict,
  history,
  predictionsValidators,
  predictValidators,
  historyValidators,
};
