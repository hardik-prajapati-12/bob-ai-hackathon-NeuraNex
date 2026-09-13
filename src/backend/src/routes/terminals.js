'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/terminalController');

// GET /api/terminals
router.get('/', ctrl.list);

// GET /api/terminals/:id — by MongoDB _id or terminalId string (e.g. "T1")
router.get('/:id', ctrl.detail);

// GET /api/terminals/:id/summary
router.get('/:id/summary', ctrl.summary);

module.exports = router;
