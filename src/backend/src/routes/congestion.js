'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 5
router.get('/current', (req, res) => success(res, [], 'Current congestion — Phase 5'));
router.get('/predictions', (req, res) => success(res, [], 'Predictions — Phase 5'));
router.post('/predict', (req, res) => success(res, null, 'Predict — Phase 5'));
router.get('/history', (req, res) => success(res, [], 'Congestion history — Phase 5'));

module.exports = router;
