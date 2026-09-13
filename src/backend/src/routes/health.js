'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/health
 * Returns application and database health status.
 */
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  return success(res, {
    status: 'ok',
    service: 'PortMind AI Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
