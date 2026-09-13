'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vesselController');
const validate = require('../middleware/validate');

// GET /api/vessels?page=1&limit=50&search=&status=&congestionRisk=&terminalCode=&sortBy=&sortOrder=
router.get('/', ctrl.listValidators, validate, ctrl.list);

// GET /api/vessels/stats — summary counts (before /:id to avoid matching 'stats' as an id)
router.get('/stats', ctrl.stats);

// GET /api/vessels/at-risk
router.get('/at-risk', ctrl.atRisk);

// GET /api/vessels/:id — by MongoDB _id or vesselId string (e.g. "V-101")
router.get('/:id', ctrl.detail);

module.exports = router;
