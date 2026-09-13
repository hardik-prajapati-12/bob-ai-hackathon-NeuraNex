'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 7
router.post('/generate', (req, res) => success(res, null, 'Generate plan — Phase 7'));
router.get('/', (req, res) => success(res, [], 'List plans — Phase 7'));
router.get('/:id', (req, res) => success(res, null, 'Plan detail — Phase 7'));

module.exports = router;
