'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 9
router.get('/', (req, res) => success(res, [], 'Alerts endpoint — Phase 9'));
router.put('/:id/acknowledge', (req, res) => success(res, null, 'Acknowledge alert — Phase 9'));

module.exports = router;
