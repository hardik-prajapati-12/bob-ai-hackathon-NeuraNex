'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/scheduleController');
const validate = require('../middleware/validate');

// GET /api/schedules?terminalCode=T1&status=ACTIVE&from=&to=&page=1&limit=50
router.get('/', ctrl.listValidators, validate, ctrl.list);

// GET /api/schedules/vessel/:vesselId — schedules for a specific vessel
router.get('/vessel/:vesselId', ctrl.byVessel);

// GET /api/schedules/:id — by MongoDB _id or scheduleId string
router.get('/:id', ctrl.detail);

module.exports = router;
