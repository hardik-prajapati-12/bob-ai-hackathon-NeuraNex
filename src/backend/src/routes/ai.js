'use strict';

/**
 * PortMind AI — AI Routes
 *
 * POST /api/ai/chat               — conversational query
 * POST /api/ai/explain-congestion — congestion root-cause explanation
 * POST /api/ai/analyze            — vessel/terminal/prediction analysis
 * POST /api/ai/operations-plan    — generate 72-hour plan
 * GET  /api/ai/status             — watsonx provider status
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

// All AI routes require authentication
router.use(authenticate);

// POST /api/ai/chat
router.post(
  '/chat',
  [
    body('message')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('message must be a non-empty string')
      .isLength({ max: 1000 })
      .withMessage('message must be 1000 characters or fewer'),
  ],
  aiController.chat
);

// POST /api/ai/explain-congestion
router.post(
  '/explain-congestion',
  [
    body('terminalCode')
      .optional()
      .isString()
      .trim()
      .withMessage('terminalCode must be a string'),
    body('terminalId')
      .optional()
      .isString()
      .trim()
      .withMessage('terminalId must be a string'),
  ],
  aiController.explainCongestion
);

// POST /api/ai/analyze
router.post(
  '/analyze',
  [
    body('type')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('type is required'),
    body('id')
      .optional()
      .isString()
      .trim(),
  ],
  aiController.analyze
);

// POST /api/ai/operations-plan
router.post('/operations-plan', aiController.operationsPlan);

// GET /api/ai/status
router.get('/status', aiController.status);

module.exports = router;
