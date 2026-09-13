'use strict';

/**
 * PortMind AI — Operations Plan Routes
 *
 * POST /api/operations-plan/generate — generate 72-hour plan
 * GET  /api/operations-plan          — list recent plans
 * GET  /api/operations-plan/:id      — get plan by id
 */

const express = require('express');
const router = express.Router();
const operationsPlanService = require('../services/operationsPlanService');
const { success, notFound } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// All operations-plan routes require authentication
router.use(authenticate);

// POST /api/operations-plan/generate
router.post('/generate', async (req, res, next) => {
  try {
    const plan = await operationsPlanService.generatePlan();
    return success(res, plan, '72-hour operations plan generated');
  } catch (err) {
    next(err);
  }
});

// GET /api/operations-plan
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const plans = await operationsPlanService.listPlans(limit);
    return success(res, plans, `${plans.length} operations plan(s) retrieved`);
  } catch (err) {
    next(err);
  }
});

// GET /api/operations-plan/:id
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await operationsPlanService.getPlanById(req.params.id);
    if (!plan) {
      return notFound(res, `Operations plan '${req.params.id}' not found`);
    }
    return success(res, plan, 'Operations plan retrieved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
