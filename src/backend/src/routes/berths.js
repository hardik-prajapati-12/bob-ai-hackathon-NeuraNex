'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 4
router.get('/', (req, res) => success(res, [], 'Berths endpoint — Phase 4'));
router.get('/available', (req, res) => success(res, [], 'Available berths — Phase 4'));
router.get('/:id', (req, res) => success(res, null, 'Berth detail — Phase 4'));

module.exports = router;
