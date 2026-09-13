'use strict';

const { query } = require('express-validator');
const scheduleService = require('../services/scheduleService');
const { success, paginated, notFound } = require('../utils/apiResponse');

const listValidators = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('from').optional().isISO8601().withMessage('from must be ISO8601 date'),
  query('to').optional().isISO8601().withMessage('to must be ISO8601 date'),
];

async function list(req, res, next) {
  try {
    const result = await scheduleService.listSchedules(req.query);
    return paginated(res, result.schedules, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    if (!schedule) return notFound(res, `Schedule '${req.params.id}' not found`);
    return success(res, schedule);
  } catch (err) {
    next(err);
  }
}

async function byVessel(req, res, next) {
  try {
    const schedules = await scheduleService.getSchedulesByVessel(req.params.vesselId);
    return success(res, schedules);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, byVessel, listValidators };
