'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/berthController');

// GET /api/berths?terminalCode=T1&status=AVAILABLE,OCCUPIED
router.get('/', ctrl.list);

// GET /api/berths/available?terminalCode=T1&minTEU=8000
router.get('/available', ctrl.available);

// GET /api/berths/:id — by MongoDB _id or berthId string (e.g. "B1-T1")
router.get('/:id', ctrl.detail);

module.exports = router;
