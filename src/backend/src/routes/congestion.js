'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/congestionController');
const validate = require('../middleware/validate');

// GET /api/congestion/current
// Live congestion assessment from the analytical scoring engine
router.get('/current', ctrl.current);

// GET /api/congestion/predictions?terminalCode=T1&horizon=24H&limit=20
// Stored prediction records
router.get('/predictions', ctrl.predictionsValidators, validate, ctrl.predictions);

// POST /api/congestion/predict
// Body: { terminalId: "T1", horizon: "24H" }
// Runs a fresh deterministic prediction and persists it
router.post('/predict', ctrl.predictValidators, validate, ctrl.predict);

// GET /api/congestion/history?terminalCode=T1&days=30
// Historical congestion trend from historicalOperations
router.get('/history', ctrl.historyValidators, validate, ctrl.history);

module.exports = router;
