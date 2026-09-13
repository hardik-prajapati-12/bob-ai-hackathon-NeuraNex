'use strict';

const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

// Placeholder — full implementation in Phase 7
router.post('/chat', (req, res) => success(res, { reply: 'AI assistant — Phase 7' }, 'AI chat placeholder'));
router.post('/analyze', (req, res) => success(res, null, 'AI analyze — Phase 7'));
router.post('/explain-congestion', (req, res) => success(res, null, 'Congestion explanation — Phase 7'));

module.exports = router;
