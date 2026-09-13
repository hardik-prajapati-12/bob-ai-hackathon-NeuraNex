'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 4
router.get('/', (req, res) => success(res, [], 'Schedules endpoint — Phase 4'));
router.get('/:id', (req, res) => success(res, null, 'Schedule detail — Phase 4'));

module.exports = router;
