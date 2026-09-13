'use strict';

const berthService = require('../services/berthService');
const { success, notFound } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const berths = await berthService.listBerths(req.query);
    return success(res, berths);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const berth = await berthService.getBerthById(req.params.id);
    if (!berth) return notFound(res, `Berth '${req.params.id}' not found`);
    return success(res, berth);
  } catch (err) {
    next(err);
  }
}

async function available(req, res, next) {
  try {
    const berths = await berthService.getAvailableBerths(req.query);
    return success(res, berths);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, available };
