'use strict';

const express = require('express');
const router = express.Router();
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const Alert = require('../models/Alert');

// GET /api/alerts
// Returns alerts with optional filters: severity, type, acknowledged, terminalCode, page, limit
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.severity)     filter.severity     = req.query.severity.toUpperCase();
    if (req.query.type)         filter.type         = req.query.type.toUpperCase();
    if (req.query.terminalCode) filter.terminalCode = req.query.terminalCode;
    if (req.query.acknowledged !== undefined) {
      filter.acknowledged = req.query.acknowledged === 'true';
    }

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Alert.countDocuments(filter),
    ]);

    return paginated(res, alerts, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    return error(res, err.message || 'Failed to load alerts', 500);
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) return notFound(res, 'Alert not found');
    return success(res, alert, 'Alert');
  } catch (err) {
    return error(res, err.message || 'Failed to load alert', 500);
  }
});

// PUT /api/alerts/:id/acknowledge
// Marks an alert as acknowledged by the current user (or 'Operator' if no auth)
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return notFound(res, 'Alert not found');

    alert.acknowledged   = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = req.user?.username || req.body?.acknowledgedBy || 'Operator';
    await alert.save();

    return success(res, alert.toObject(), 'Alert acknowledged');
  } catch (err) {
    return error(res, err.message || 'Failed to acknowledge alert', 500);
  }
});

module.exports = router;
