'use strict';

const Berth = require('../models/Berth');

async function listBerths(query = {}) {
  const filter = {};
  if (query.terminalCode) filter.terminalCode = query.terminalCode;
  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim().toUpperCase());
    filter.currentStatus = { $in: statuses };
  }

  return Berth.find(filter)
    .sort({ terminalCode: 1, berthNumber: 1 })
    .populate('terminalId', 'terminalId name')
    .populate('assignedVesselId', 'vesselId vesselName sizeTEU status estimatedDeparture')
    .lean();
}

async function getBerthById(id) {
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { berthId: id };

  return Berth.findOne(query)
    .populate('terminalId', 'terminalId name shortName operationalStatus')
    .populate('assignedVesselId', 'vesselId vesselName sizeTEU status arrivalTime estimatedDeparture waitingHours')
    .lean();
}

async function getAvailableBerths(query = {}) {
  const filter = { currentStatus: 'AVAILABLE' };
  if (query.terminalCode) filter.terminalCode = query.terminalCode;
  if (query.minTEU) filter.maxVesselSizeTEU = { $gte: parseInt(query.minTEU, 10) };

  return Berth.find(filter)
    .sort({ maxVesselSizeTEU: -1 })
    .populate('terminalId', 'terminalId name')
    .lean();
}

module.exports = { listBerths, getBerthById, getAvailableBerths };
