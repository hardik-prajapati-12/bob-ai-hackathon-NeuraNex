'use strict';

const craneService = require('../services/craneService');
const { success, notFound } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const cranes = await craneService.listCranes(req.query);
    return success(res, cranes);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const crane = await craneService.getCraneById(req.params.id);
    if (!crane) return notFound(res, `Crane '${req.params.id}' not found`);
    return success(res, crane);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail };
