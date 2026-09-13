'use strict';

/**
 * PortMind AI — Utilization Calculator
 *
 * Calculates berth and crane utilization metrics from live database data.
 * All calculations are deterministic and derived from real collection data.
 */

const Berth = require('../models/Berth');
const Crane = require('../models/Crane');
const Vessel = require('../models/Vessel');

/**
 * Calculate berth utilization for a single terminal.
 *
 * @param {mongoose.Types.ObjectId} terminalId
 * @returns {object} berth utilization metrics
 */
async function calcBerthUtilization(terminalId) {
  const berths = await Berth.find({ terminalId }).lean();

  if (!berths.length) {
    return {
      total: 0,
      available: 0,
      occupied: 0,
      maintenance: 0,
      utilizationPercent: 0,
      avgUtilizationPercent: 0,
    };
  }

  const available = berths.filter((b) => b.currentStatus === 'AVAILABLE').length;
  const occupied = berths.filter((b) => b.currentStatus === 'OCCUPIED').length;
  const maintenance = berths.filter(
    (b) => b.currentStatus === 'MAINTENANCE' || b.currentStatus === 'RESERVED'
  ).length;
  const active = available + occupied; // berths that can handle vessels

  const avgUtil =
    berths.length > 0
      ? berths.reduce((sum, b) => sum + (b.utilizationPercent || 0), 0) / berths.length
      : 0;

  return {
    total: berths.length,
    available,
    occupied,
    maintenance,
    active,
    utilizationPercent: active > 0 ? Math.round((occupied / active) * 100) : 0,
    avgUtilizationPercent: Math.round(avgUtil),
    occupancyFactor: active > 0 ? parseFloat((occupied / active).toFixed(4)) : 0,
  };
}

/**
 * Calculate crane utilization for a single terminal.
 *
 * @param {mongoose.Types.ObjectId} terminalId
 * @returns {object} crane utilization metrics
 */
async function calcCraneUtilization(terminalId) {
  const cranes = await Crane.find({ terminalId }).lean();

  if (!cranes.length) {
    return {
      total: 0,
      active: 0,
      idle: 0,
      maintenance: 0,
      availabilityPercent: 0,
      avgUtilizationPercent: 0,
    };
  }

  const active = cranes.filter((c) => c.status === 'ACTIVE').length;
  const idle = cranes.filter((c) => c.status === 'IDLE').length;
  const maintenance = cranes.filter(
    (c) => c.status === 'MAINTENANCE' || c.status === 'BREAKDOWN'
  ).length;

  const avgUtil =
    cranes.length > 0
      ? cranes.reduce((sum, c) => sum + (c.utilizationPercent || 0), 0) / cranes.length
      : 0;

  const availabilityPercent =
    cranes.length > 0 ? Math.round(((active + idle) / cranes.length) * 100) : 0;

  return {
    total: cranes.length,
    active,
    idle,
    maintenance,
    availabilityPercent,
    avgUtilizationPercent: Math.round(avgUtil),
    activePercent: cranes.length > 0 ? Math.round((active / cranes.length) * 100) : 0,
  };
}

/**
 * Aggregate vessel stats for a terminal needed by the scorer.
 * Counts vessels by status and calculates crane demand.
 *
 * @param {mongoose.Types.ObjectId} terminalId
 * @returns {object} vessel metrics for congestion scoring
 */
async function calcVesselMetrics(terminalId) {
  const vessels = await Vessel.find({
    terminalId,
    status: { $in: ['AT_BERTH', 'WAITING', 'INBOUND', 'DELAYED'] },
  }).lean();

  const atBerth = vessels.filter((v) => v.status === 'AT_BERTH').length;
  const waiting = vessels.filter((v) => v.status === 'WAITING').length;
  const delayed = vessels.filter((v) => v.status === 'DELAYED').length;
  const inbound = vessels.filter((v) => v.status === 'INBOUND').length;

  const queuedVessels = waiting + delayed;
  const totalActive = vessels.length;

  const largeVesselCount = vessels.filter((v) => (v.sizeTEU || 0) >= 8000).length;

  // Required cranes: sum of requiredCranes for AT_BERTH + WAITING + DELAYED vessels
  const requiredCranes = vessels
    .filter((v) => ['AT_BERTH', 'WAITING', 'DELAYED'].includes(v.status))
    .reduce((sum, v) => sum + (v.requiredCranes || 2), 0);

  const avgWaitingHours =
    queuedVessels > 0
      ? vessels
          .filter((v) => v.status === 'WAITING' || v.status === 'DELAYED')
          .reduce((sum, v) => sum + (v.waitingHours || 0), 0) / queuedVessels
      : 0;

  return {
    atBerth,
    waiting,
    delayed,
    inbound,
    queuedVessels,
    totalActive,
    largeVesselCount,
    requiredCranes,
    avgWaitingHours: parseFloat(avgWaitingHours.toFixed(2)),
  };
}

/**
 * Full utilization snapshot for one terminal.
 * Returns all metrics needed by the congestion scorer and the API.
 *
 * @param {object} terminal - terminal document (from Mongoose)
 * @returns {object} full utilization snapshot
 */
async function getTerminalUtilizationSnapshot(terminal) {
  const [berthMetrics, craneMetrics, vesselMetrics] = await Promise.all([
    calcBerthUtilization(terminal._id),
    calcCraneUtilization(terminal._id),
    calcVesselMetrics(terminal._id),
  ]);

  const teuUtilization =
    terminal.maxTEUCapacity > 0
      ? parseFloat(((terminal.currentTEULoad / terminal.maxTEUCapacity) * 100).toFixed(1))
      : 0;

  return {
    terminalId: terminal._id,
    terminalCode: terminal.terminalId,
    terminalName: terminal.name,
    teuLoad: terminal.currentTEULoad || 0,
    maxTEUCapacity: terminal.maxTEUCapacity,
    teuUtilizationPercent: teuUtilization,
    berths: berthMetrics,
    cranes: craneMetrics,
    vessels: vesselMetrics,
  };
}

module.exports = {
  calcBerthUtilization,
  calcCraneUtilization,
  calcVesselMetrics,
  getTerminalUtilizationSnapshot,
};
