'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 4
router.get('/', (req, res) => success(res, [], 'Vessels endpoint — Phase 4'));
router.get('/at-risk', (req, res) => success(res, [], 'At-risk vessels — Phase 4'));
router.get('/:id', (req, res) => success(res, null, 'Vessel detail — Phase 4'));

module.exports = router;
