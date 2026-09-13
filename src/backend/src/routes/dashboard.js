'use strict';

const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/apiResponse');
const congestionService = require('../services/congestionService');
const vesselService = require('../services/vesselService');
const Alert = require('../models/Alert');
const Berth = require('../models/Berth');

// GET /api/dashboard/summary
// Returns live KPI snapshot for the dashboard overview
router.get('/summary', async (req, res, next) => {
  try {
    const [congestion, vesselStats, activeAlerts, berths] = await Promise.all([
      congestionService.getCurrentCongestion(),
      vesselService.getVesselStats(),
      Alert.countDocuments({ acknowledged: false }),
      Berth.find().lean(),
    ]);

    const occupiedBerths = berths.filter(b => b.currentStatus === 'OCCUPIED').length;
    const maintenanceBerths = berths.filter(b => b.currentStatus === 'MAINTENANCE').length;
    const operationalBerths = berths.length - maintenanceBerths;
    const berthUtilization = operationalBerths > 0
      ? Math.round((occupiedBerths / operationalBerths) * 100)
      : 0;

    return success(res, {
      totalVessels: vesselStats.total,
      atRiskVessels: vesselStats.atRisk,
      berthUtilization,
      activeAlerts,
      congestionLevel: congestion.overallLevel,
      congestionScore: congestion.overallScore,
      vesselsByStatus: vesselStats.byStatus,
      vesselsByRisk: vesselStats.byRisk,
      terminals: congestion.terminals.map(t => ({
        terminalCode: t.terminalCode,
        terminalName: t.terminalName,
        congestionLevel: t.congestionLevel,
        congestionScore: t.congestionScore,
        berthsOccupied: t.snapshot?.berths?.occupied ?? 0,
        berthsTotal: t.snapshot?.berths?.total ?? 0,
        queuedVessels: t.snapshot?.vessels?.queuedVessels ?? 0,
      })),
    }, 'Dashboard summary');
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/charts
// Returns chart-ready time-series data for the dashboard
router.get('/charts', async (req, res, next) => {
  try {
    const history = await congestionService.getCongestionHistory({ days: 14 });
    return success(res, {
      congestionTrend: history.series || [],
      vesselArrivals: [],
      berthUtilization: [],
    }, 'Dashboard charts');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
