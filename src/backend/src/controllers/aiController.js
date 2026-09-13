'use strict';

/**
 * PortMind AI — AI Controller
 *
 * Handles:
 *   POST /api/ai/chat              — conversational query
 *   POST /api/ai/explain-congestion — congestion root-cause explanation
 *   POST /api/ai/analyze           — vessel/terminal/prediction analysis
 *   POST /api/ai/operations-plan   — generate 72-hour plan (via operationsPlanService)
 *   GET  /api/ai/status            — watsonx configuration status
 */

const { validationResult } = require('express-validator');
const aiService = require('../ai/aiService');
const operationsPlanService = require('../services/operationsPlanService');
const { success, badRequest, notFound } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    badRequest(res, 'Validation failed', errors.array());
    return false;
  }
  return true;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/chat
 * Body: { message: string }
 */
async function chat(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return badRequest(res, 'message is required and must be a non-empty string');
    }

    const result = await aiService.chat(message);
    return success(res, result, 'Chat response generated');
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    next(err);
  }
}

/**
 * POST /api/ai/explain-congestion
 * Body: { terminalCode: string }
 *
 * Also accepts { terminalId: string } for backwards compat with the existing frontend api/ai.js
 */
async function explainCongestion(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const terminalCode = req.body.terminalCode || req.body.terminalId;
    if (!terminalCode || typeof terminalCode !== 'string' || terminalCode.trim().length === 0) {
      return badRequest(res, 'terminalCode is required');
    }

    const result = await aiService.explainCongestion(terminalCode);
    return success(res, result, 'Congestion explanation generated');
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    if (err.statusCode === 404) return notFound(res, err.message);
    next(err);
  }
}

/**
 * POST /api/ai/analyze
 * Body: { type: string, id: string }
 * Dispatches to appropriate context based on type.
 */
async function analyze(req, res, next) {
  try {
    if (!handleValidation(req, res)) return;

    const { type, id } = req.body;
    if (!type) {
      return badRequest(res, 'type is required (vessel | terminal | prediction)');
    }

    const ltype = String(type).toLowerCase();
    let result;

    if (ltype === 'terminal') {
      if (!id) return badRequest(res, 'id (terminal code) is required for type=terminal');
      result = await aiService.explainCongestion(id);
    } else {
      // For vessel/prediction types — use chat with a constructed query
      const query = id
        ? `Analyze ${type} ${id} and provide current status, risks, and recommendations.`
        : `Provide an analysis of current ${type} operations across the port.`;
      result = await aiService.chat(query);
    }

    return success(res, result, `Analysis for ${type} completed`);
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    if (err.statusCode === 404) return notFound(res, err.message);
    next(err);
  }
}

/**
 * POST /api/ai/operations-plan
 * Generates and saves a 72-hour operations plan.
 */
async function operationsPlan(req, res, next) {
  try {
    const plan = await operationsPlanService.generatePlan();
    return success(res, plan, '72-hour operations plan generated');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ai/status
 * Returns watsonx configuration status.
 */
async function status(req, res) {
  const s = aiService.getStatus();
  return success(res, s, 'AI provider status');
}

module.exports = { chat, explainCongestion, analyze, operationsPlan, status };
