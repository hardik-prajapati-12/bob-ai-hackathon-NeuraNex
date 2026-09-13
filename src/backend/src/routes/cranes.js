'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/craneController');

// GET /api/cranes?terminalCode=T1&status=ACTIVE&type=SHIP_TO_SHORE
router.get('/', ctrl.list);

// GET /api/cranes/:id — by MongoDB _id or craneId string (e.g. "C1-T1")
router.get('/:id', ctrl.detail);

module.exports = router;
