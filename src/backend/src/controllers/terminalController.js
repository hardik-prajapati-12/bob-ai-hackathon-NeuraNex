'use strict';

const terminalService = require('../services/terminalService');
const { success, notFound } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const terminals = await terminalService.listTerminals();
    return success(res, terminals);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const terminal = await terminalService.getTerminalById(req.params.id);
    if (!terminal) return notFound(res, `Terminal '${req.params.id}' not found`);
    return success(res, terminal);
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const data = await terminalService.getTerminalSummary(req.params.id);
    if (!data) return notFound(res, `Terminal '${req.params.id}' not found`);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, summary };
