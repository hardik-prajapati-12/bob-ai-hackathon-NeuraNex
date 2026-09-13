'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/optimizationController');
const validate = require('../middleware/validate');

// GET /api/optimization/berths?terminalCode=T1
// Berth recommendations for vessels needing allocation
router.get('/berths', ctrl.terminalCodeValidator, validate, ctrl.berths);

// GET /api/optimization/cranes?terminalCode=T1
// Crane allocation recommendations
router.get('/cranes', ctrl.terminalCodeValidator, validate, ctrl.cranes);

// GET /api/optimization/conflicts?terminalCode=T1
// Detected operational conflicts
router.get('/conflicts', ctrl.terminalCodeValidator, validate, ctrl.conflicts);

// POST /api/optimization/optimize
// Body: { terminalCode? }
// Full optimization pass: berths + cranes + conflicts + summary
router.post('/optimize', ctrl.optimizeValidators, validate, ctrl.optimize);

// GET /api/optimization/recommendations?terminalCode=T1&type=BERTH_REALLOCATION&status=PENDING
// Stored recommendation records
router.get('/recommendations', ctrl.recsValidators, validate, ctrl.recommendations);

// Legacy: POST /optimization/berths and /optimization/cranes kept for API compat
// (the GET endpoints are the primary interface)
router.post('/berths', ctrl.optimize);  // redirect to full optimize for backwards compat
router.post('/cranes', ctrl.optimize);

module.exports = router;
