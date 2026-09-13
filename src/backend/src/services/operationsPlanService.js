'use strict';

/**
 * PortMind AI — Operations Plan Service
 *
 * Orchestrates plan generation and persistence:
 *   generatePlan()      — calls aiService, saves to DB, returns plan
 *   listPlans(limit)    — recent plans
 *   getPlanById(id)     — single plan by MongoDB ObjectId or planId string
 */

const aiService = require('../ai/aiService');
const OperationsPlan = require('../models/OperationsPlan');
const Terminal = require('../models/Terminal');
const logger = require('../utils/logger');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a new 72-hour operations plan and persist it.
 * @returns {object}  saved plan document
 */
async function generatePlan() {
  // Generate plan via AI service
  const aiPlan = await aiService.generateOperationsPlan();

  // Fetch all terminals for linking
  const terminals = await Terminal.find().lean();
  const terminalIds = terminals.map((t) => t._id);
  const terminalCodes = terminals.map((t) => t.terminalId);

  // Unique planId
  const planId = `PLAN-${Date.now()}`;

  const doc = await OperationsPlan.create({
    planId,
    horizon: '72H',
    generatedBy: aiPlan.isFallback ? 'SYSTEM' : 'AI_ENGINE',
    terminalIds,
    terminalCodes,
    windows: aiPlan.windows || [],
    summary: aiPlan.summary || null,
    overallRiskLevel: aiPlan.overallRiskLevel || 'MEDIUM',
    status: 'ACTIVE',
    isDemoData: true,
  });

  logger.info('operationsPlanService: plan generated', {
    planId,
    isFallback: aiPlan.isFallback,
    windows: doc.windows.length,
  });

  return {
    ...doc.toObject(),
    isFallback: aiPlan.isFallback,
    fallbackReason: aiPlan.fallbackReason || null,
    dataLabel: aiPlan.dataLabel || 'AI GENERATED · DEMO DATA',
  };
}

/**
 * List recent operations plans.
 * @param {number} limit  — max records (default 10)
 * @returns {Array}
 */
async function listPlans(limit = 10) {
  const plans = await OperationsPlan.find({ status: { $in: ['ACTIVE', 'DRAFT'] } })
    .sort({ generatedAt: -1 })
    .limit(Math.min(50, limit))
    .lean();

  return plans;
}

/**
 * Get a single plan by MongoDB ObjectId or planId string.
 * @param {string} id
 * @returns {object|null}
 */
async function getPlanById(id) {
  if (!id) return null;

  const mongoose = require('mongoose');

  let plan = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    plan = await OperationsPlan.findById(id).lean();
  }
  if (!plan) {
    plan = await OperationsPlan.findOne({ planId: id }).lean();
  }
  return plan;
}

module.exports = { generatePlan, listPlans, getPlanById };
