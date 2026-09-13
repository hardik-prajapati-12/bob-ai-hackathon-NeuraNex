'use strict';

const Vessel = require('../models/Vessel');

/**
 * Build a Mongoose query filter from request query params.
 */
function buildFilter(query) {
  const filter = {};

  if (query.terminalCode) filter.terminalCode = query.terminalCode;
  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim().toUpperCase());
    filter.status = { $in: statuses };
  }
  if (query.congestionRisk) {
    const risks = query.congestionRisk.split(',').map(r => r.trim().toUpperCase());
    filter.congestionRisk = { $in: risks };
  }
  if (query.priority) filter.priority = query.priority.toUpperCase();
  if (query.vesselType) filter.vesselType = query.vesselType.toUpperCase();

  // Text search on vesselName or vesselId
  if (query.search) {
    const re = new RegExp(query.search, 'i');
    filter.$or = [{ vesselName: re }, { vesselId: re }, { imoNumber: re }, { shippingLine: re }];
  }

  return filter;
}

function buildSort(query) {
  const allowed = {
    arrivalTime: 'arrivalTime',
    vesselName: 'vesselName',
    sizeTEU: 'sizeTEU',
    waitingHours: 'waitingHours',
    congestionRiskScore: 'congestionRiskScore',
  };
  const field = allowed[query.sortBy] || 'arrivalTime';
  const order = query.sortOrder === 'desc' ? -1 : 1;
  return { [field]: order };
}

async function listVessels(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const filter = buildFilter(query);
  const sort = buildSort(query);

  const [vessels, total] = await Promise.all([
    Vessel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('terminalId', 'terminalId name shortName')
      .populate('assignedBerthId', 'berthId name currentStatus')
      .lean(),
    Vessel.countDocuments(filter),
  ]);

  return {
    vessels,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getVesselById(id) {
  // Support lookup by MongoDB _id or vesselId string
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { vesselId: id };

  return Vessel.findOne(query)
    .populate('terminalId', 'terminalId name shortName operationalStatus')
    .populate('assignedBerthId', 'berthId name currentStatus processingRateTEUPerHour craneCount')
    .populate('assignedCraneIds', 'craneId name type status liftCapacityTEUPerHour')
    .lean();
}

async function getAtRiskVessels() {
  return Vessel.find({ congestionRisk: { $in: ['HIGH', 'CRITICAL'] } })
    .sort({ congestionRiskScore: -1 })
    .limit(20)
    .populate('terminalId', 'terminalId name')
    .populate('assignedBerthId', 'berthId name')
    .lean();
}

async function getVesselStats() {
  const [statusCounts, riskCounts, total] = await Promise.all([
    Vessel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Vessel.aggregate([{ $group: { _id: '$congestionRisk', count: { $sum: 1 } } }]),
    Vessel.countDocuments(),
  ]);

  const byStatus = {};
  statusCounts.forEach(s => { byStatus[s._id] = s.count; });

  const byRisk = {};
  riskCounts.forEach(r => { byRisk[r._id] = r.count; });

  return {
    total,
    byStatus,
    byRisk,
    atRisk: (byRisk.HIGH || 0) + (byRisk.CRITICAL || 0),
    waiting: byStatus.WAITING || 0,
    atBerth: byStatus.AT_BERTH || 0,
    inbound: byStatus.INBOUND || 0,
  };
}

module.exports = { listVessels, getVesselById, getAtRiskVessels, getVesselStats };
