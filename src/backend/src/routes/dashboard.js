'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 9
router.get('/summary', (req, res) => success(res, {
  totalVessels: 0,
  atRiskVessels: 0,
  berthUtilization: 0,
  craneUtilization: 0,
  activeAlerts: 0,
  congestionLevel: 'UNKNOWN',
}, 'Dashboard summary — Phase 9'));

router.get('/charts', (req, res) => success(res, {
  congestionTrend: [],
  vesselArrivals: [],
  berthUtilization: [],
}, 'Dashboard charts — Phase 9'));

module.exports = router;
