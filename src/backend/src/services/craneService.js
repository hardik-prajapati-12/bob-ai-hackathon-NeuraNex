'use strict';

const Crane = require('../models/Crane');

async function listCranes(query = {}) {
  const filter = {};
  if (query.terminalCode) filter.terminalCode = query.terminalCode;
  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim().toUpperCase());
    filter.status = { $in: statuses };
  }
  if (query.type) filter.type = query.type.toUpperCase();

  return Crane.find(filter)
    .sort({ terminalCode: 1, craneId: 1 })
    .populate('terminalId', 'terminalId name')
    .populate('assignedVesselId', 'vesselId vesselName sizeTEU')
    .lean();
}

async function getCraneById(id) {
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { craneId: id };

  return Crane.findOne(query)
    .populate('terminalId', 'terminalId name shortName')
    .populate('berthId', 'berthId name')
    .populate('assignedVesselId', 'vesselId vesselName sizeTEU status')
    .lean();
}

module.exports = { listCranes, getCraneById };
