'use strict';

const { query, param } = require('express-validator');
const vesselService = require('../services/vesselService');
const { success, paginated, notFound, badRequest } = require('../utils/apiResponse');

const listValidators = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['arrivalTime', 'vesselName', 'sizeTEU', 'waitingHours', 'congestionRiskScore']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

async function list(req, res, next) {
  try {
    const result = await vesselService.listVessels(req.query);
    return paginated(res, result.vessels, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const vessel = await vesselService.getVesselById(req.params.id);
    if (!vessel) return notFound(res, `Vessel '${req.params.id}' not found`);
    return success(res, vessel);
  } catch (err) {
    next(err);
  }
}

async function atRisk(req, res, next) {
  try {
    const vessels = await vesselService.getAtRiskVessels();
    return success(res, vessels);
  } catch (err) {
    next(err);
  }
}

async function stats(req, res, next) {
  try {
    const data = await vesselService.getVesselStats();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, atRisk, stats, listValidators };
