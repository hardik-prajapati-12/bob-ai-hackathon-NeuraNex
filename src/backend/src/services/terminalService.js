'use strict';

const Terminal = require('../models/Terminal');
const Berth = require('../models/Berth');
const Crane = require('../models/Crane');
const Vessel = require('../models/Vessel');

async function listTerminals() {
  return Terminal.find().sort({ terminalId: 1 }).lean();
}

async function getTerminalById(id) {
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { terminalId: id };

  const terminal = await Terminal.findOne(query).lean();
  if (!terminal) return null;

  // Enrich with related berths, cranes, and active vessel count
  const [berths, cranes, activeVessels] = await Promise.all([
    Berth.find({ terminalId: terminal._id })
      .sort({ berthNumber: 1 })
      .populate('assignedVesselId', 'vesselId vesselName sizeTEU status')
      .lean(),
    Crane.find({ terminalId: terminal._id })
      .sort({ craneId: 1 })
      .populate('assignedVesselId', 'vesselId vesselName')
      .lean(),
    Vessel.countDocuments({
      terminalId: terminal._id,
      status: { $in: ['AT_BERTH', 'WAITING', 'INBOUND', 'DELAYED'] },
    }),
  ]);

  return { ...terminal, berths, cranes, activeVessels };
}

async function getTerminalSummary(id) {
  const query = id.match(/^[a-fA-F0-9]{24}$/)
    ? { _id: id }
    : { terminalId: id };

  const terminal = await Terminal.findOne(query).lean();
  if (!terminal) return null;

  const [berthStats, craneStats, vesselStats] = await Promise.all([
    Berth.aggregate([
      { $match: { terminalId: terminal._id } },
      {
        $group: {
          _id: '$currentStatus',
          count: { $sum: 1 },
          avgUtilization: { $avg: '$utilizationPercent' },
        },
      },
    ]),
    Crane.aggregate([
      { $match: { terminalId: terminal._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Vessel.aggregate([
      { $match: { terminalId: terminal._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const berthByStatus = {};
  berthStats.forEach(b => { berthByStatus[b._id] = { count: b.count, avgUtil: Math.round(b.avgUtilization || 0) }; });

  const craneByStatus = {};
  craneStats.forEach(c => { craneByStatus[c._id] = c.count; });

  const vesselByStatus = {};
  vesselStats.forEach(v => { vesselByStatus[v._id] = v.count; });

  return {
    terminal,
    berthSummary: berthByStatus,
    craneSummary: craneByStatus,
    vesselSummary: vesselByStatus,
    utilizationPercent: terminal.maxTEUCapacity
      ? Math.round((terminal.currentTEULoad / terminal.maxTEUCapacity) * 100)
      : 0,
  };
}

module.exports = { listTerminals, getTerminalById, getTerminalSummary };
