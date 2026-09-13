'use strict';

const Schedule = require('../models/Schedule');

function buildScheduleFilter(query) {
  const filter = {};
  if (query.terminalCode) filter.terminalCode = query.terminalCode;
  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim().toUpperCase());
    filter.status = { $in: statuses };
  }
  if (query.priority) filter.priority = query.priority.toUpperCase();

  // Date range filter on plannedArrival
  if (query.from || query.to) {
    filter.plannedArrival = {};
    if (query.from) filter.plannedArrival.$gte = new Date(query.from);
    if (query.to) filter.plannedArrival.$lte = new Date(query.to);
  }

  return filter;
}

async function listSchedules(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const filter = buildScheduleFilter(query);
  const sort = query.sortOrder === 'desc'
    ? { plannedArrival: -1 }
    : { plannedArrival: 1 };

  const [schedules, total] = await Promise.all([
    Schedule.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('vesselId', 'vesselId vesselName sizeTEU vesselType shippingLine flag congestionRisk')
      .populate('terminalId', 'terminalId name')
      .populate('berthId', 'berthId name currentStatus')
      .lean(),
    Schedule.countDocuments(filter),
  ]);

  return {
    schedules,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function getScheduleById(id) {
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { scheduleId: id };

  return Schedule.findOne(query)
    .populate('vesselId', 'vesselId vesselName sizeTEU vesselType shippingLine flag status congestionRisk waitingHours')
    .populate('terminalId', 'terminalId name operationalStatus')
    .populate('berthId', 'berthId name currentStatus processingRateTEUPerHour craneCount')
    .populate('craneAssignments', 'craneId name type status liftCapacityTEUPerHour')
    .lean();
}

async function getSchedulesByVessel(vesselId) {
  return Schedule.find({ vesselCode: vesselId })
    .sort({ plannedArrival: -1 })
    .populate('terminalId', 'terminalId name')
    .populate('berthId', 'berthId name')
    .lean();
}

module.exports = { listSchedules, getScheduleById, getSchedulesByVessel };
