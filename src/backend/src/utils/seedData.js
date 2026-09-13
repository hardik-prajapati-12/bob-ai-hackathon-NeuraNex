'use strict';

/**
 * PortMind AI — Synthetic Demo Data Seed Script
 *
 * WARNING: This is SYNTHETIC DEMO DATA generated for the IBM Bob AI Hackathon 2026.
 * It does NOT represent real port operational data.
 * All vessel names, IMO numbers, and operational figures are fictional.
 *
 * Usage:
 *   npm run seed          — clear and re-seed all collections
 *   npm run seed:reset    — alias for the same operation
 *
 * Seeding order (respects foreign-key dependencies):
 *   1. Terminals
 *   2. Berths        (ref → Terminal)
 *   3. Cranes        (ref → Terminal, Berth)
 *   4. Vessels       (ref → Terminal, Berth)
 *   5. Schedules     (ref → Vessel, Terminal, Berth, Crane)
 *   6. HistoricalOperations (ref → Terminal)
 *   7. CongestionPredictions (ref → Terminal, Berth)
 *   8. Recommendations (ref → Terminal, Vessel, Berth, Crane)
 *   9. Alerts        (ref → Terminal, Vessel, Berth)
 *  10. OperationsPlans (ref → Terminal)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');

// Models
const Terminal = require('../models/Terminal');
const Berth = require('../models/Berth');
const Crane = require('../models/Crane');
const Vessel = require('../models/Vessel');
const Schedule = require('../models/Schedule');
const HistoricalOperation = require('../models/HistoricalOperation');
const CongestionPrediction = require('../models/CongestionPrediction');
const Recommendation = require('../models/Recommendation');
const Alert = require('../models/Alert');
const OperationsPlan = require('../models/OperationsPlan');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portmind';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}
function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 3600 * 1000);
}
function subtractDays(date, days) {
  return new Date(date.getTime() - days * 24 * 3600 * 1000);
}
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Congestion risk score → level
function riskLevel(score) {
  if (score >= 0.80) return 'CRITICAL';
  if (score >= 0.60) return 'HIGH';
  if (score >= 0.35) return 'MEDIUM';
  return 'LOW';
}

// ─── Reference time: "now" for the demo ─────────────────────────────────────
const NOW = new Date();
NOW.setMinutes(0, 0, 0); // round to hour

// ─── 1. TERMINALS ─────────────────────────────────────────────────────────────

const TERMINAL_DEFS = [
  {
    // Scenario 1 — LOW congestion, normal operations
    terminalId: 'T1',
    name: 'Terminal 1 — West Quay',
    shortName: 'T1-WQ',
    location: { description: 'West Quay, Port of PortMind', lat: 1.264, lng: 103.820 },
    totalBerths: 7,
    activeBerths: 7,
    maxTEUCapacity: 18000,
    currentTEULoad: 7200,   // ~40% — LOW
    totalCranes: 10,
    activeCranes: 9,
    operationalStatus: 'ACTIVE',
    avgProcessingRateTEUPerHour: 320,
    maxVesselsSimultaneous: 7,
  },
  {
    // Scenario 2 — MEDIUM/HIGH congestion, increasing vessel queue
    terminalId: 'T2',
    name: 'Terminal 2 — North Berth',
    shortName: 'T2-NB',
    location: { description: 'North Berth, Port of PortMind', lat: 1.271, lng: 103.834 },
    totalBerths: 7,
    activeBerths: 6,
    maxTEUCapacity: 20000,
    currentTEULoad: 14800,  // ~74% — MEDIUM/HIGH
    totalCranes: 12,
    activeCranes: 10,
    operationalStatus: 'ACTIVE',
    avgProcessingRateTEUPerHour: 350,
    maxVesselsSimultaneous: 7,
  },
  {
    // Scenario 3 — CRITICAL congestion, crane shortfall, high berth utilization
    terminalId: 'T3',
    name: 'Terminal 3 — East Container Hub',
    shortName: 'T3-ECH',
    location: { description: 'East Container Hub, Port of PortMind', lat: 1.278, lng: 103.848 },
    totalBerths: 6,
    activeBerths: 5,
    maxTEUCapacity: 16000,
    currentTEULoad: 14900,  // ~93% — CRITICAL
    totalCranes: 9,
    activeCranes: 5,       // 4 cranes in maintenance → crane shortfall
    operationalStatus: 'REDUCED',
    avgProcessingRateTEUPerHour: 280,
    maxVesselsSimultaneous: 5,
  },
];

// ─── 2. BERTHS ────────────────────────────────────────────────────────────────

function makeBerths(terminalDoc) {
  const berths = [];
  const tid = terminalDoc._id;
  const tc = terminalDoc.terminalId;
  const count = terminalDoc.totalBerths;

  const configs = {
    T1: [
      { maxTEU: 14000, len: 340, draft: 16, cranes: 3, rate: 380 },
      { maxTEU: 14000, len: 340, draft: 16, cranes: 3, rate: 380 },
      { maxTEU: 8000,  len: 280, draft: 14, cranes: 2, rate: 300 },
      { maxTEU: 8000,  len: 280, draft: 14, cranes: 2, rate: 300 },
      { maxTEU: 5000,  len: 240, draft: 12, cranes: 2, rate: 260 },
      { maxTEU: 5000,  len: 240, draft: 12, cranes: 2, rate: 260 },
      { maxTEU: 3000,  len: 200, draft: 10, cranes: 1, rate: 200 },
    ],
    T2: [
      { maxTEU: 18000, len: 400, draft: 17, cranes: 4, rate: 420 },
      { maxTEU: 18000, len: 400, draft: 17, cranes: 4, rate: 420 },
      { maxTEU: 14000, len: 340, draft: 16, cranes: 3, rate: 380 },
      { maxTEU: 14000, len: 340, draft: 16, cranes: 3, rate: 380 },
      { maxTEU: 8000,  len: 280, draft: 14, cranes: 2, rate: 300 },
      { maxTEU: 8000,  len: 280, draft: 14, cranes: 2, rate: 300 },
      { maxTEU: 5000,  len: 240, draft: 12, cranes: 2, rate: 260 },
    ],
    T3: [
      { maxTEU: 16000, len: 380, draft: 16, cranes: 3, rate: 360 },
      { maxTEU: 16000, len: 380, draft: 16, cranes: 3, rate: 360 },
      { maxTEU: 10000, len: 300, draft: 15, cranes: 2, rate: 320 },
      { maxTEU: 8000,  len: 280, draft: 14, cranes: 2, rate: 300 },
      { maxTEU: 6000,  len: 250, draft: 12, cranes: 2, rate: 270 },
      { maxTEU: 6000,  len: 250, draft: 12, cranes: 2, rate: 270 },
    ],
  };

  const cfg = configs[tc];

  // Statuses — T3 is under pressure, T2 mostly occupied, T1 mixed
  const statusMaps = {
    T1: ['AVAILABLE', 'OCCUPIED', 'AVAILABLE', 'OCCUPIED', 'AVAILABLE', 'AVAILABLE', 'MAINTENANCE'],
    T2: ['OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'AVAILABLE', 'MAINTENANCE'],
    T3: ['OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'OCCUPIED', 'MAINTENANCE'],
  };

  const utilizationMap = {
    T1: [30, 75, 20, 68, 15, 25, 0],
    T2: [95, 88, 82, 91, 78, 40, 0],
    T3: [92, 96, 88, 85, 90, 0],
  };

  for (let i = 0; i < count; i++) {
    const c = cfg[i];
    berths.push({
      berthId: `B${i + 1}-${tc}`,
      terminalId: tid,
      terminalCode: tc,
      name: `Berth ${i + 1}`,
      maxVesselSizeTEU: c.maxTEU,
      maxVesselLengthM: c.len,
      maxDraftM: c.draft,
      currentStatus: statusMaps[tc][i],
      assignedVesselId: null, // set later
      availableFrom: statusMaps[tc][i] === 'OCCUPIED' ? addHours(NOW, rand(6, 24)) : null,
      craneCount: c.cranes,
      processingRateTEUPerHour: c.rate,
      utilizationPercent: utilizationMap[tc][i],
      berthNumber: i + 1,
      isDemoData: true,
    });
  }
  return berths;
}

// ─── 3. CRANES ────────────────────────────────────────────────────────────────

function makeCranes(terminalDoc, berthDocs) {
  const cranes = [];
  const tc = terminalDoc.terminalId;
  const tid = terminalDoc._id;

  const craneDefs = {
    T1: [
      // STS cranes (Berths 1-2)
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE',  berth: 0, util: 72 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE',  berth: 0, util: 68 },
      { type: 'SHIP_TO_SHORE', cap: 26, status: 'ACTIVE',  berth: 1, util: 75 },
      { type: 'SHIP_TO_SHORE', cap: 26, status: 'ACTIVE',  berth: 1, util: 71 },
      // STS cranes (Berths 3-4)
      { type: 'SHIP_TO_SHORE', cap: 24, status: 'ACTIVE',  berth: 2, util: 55 },
      { type: 'SHIP_TO_SHORE', cap: 24, status: 'ACTIVE',  berth: 3, util: 62 },
      // RTG cranes
      { type: 'RUBBER_TIRED_GANTRY', cap: 18, status: 'ACTIVE', berth: null, util: 60 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 18, status: 'ACTIVE', berth: null, util: 55 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 18, status: 'IDLE',   berth: null, util: 0  },
      { type: 'RUBBER_TIRED_GANTRY', cap: 18, status: 'MAINTENANCE', berth: null, util: 0 },
    ],
    T2: [
      // 4 large STS (Berths 1-2 — 4 cranes each)
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 0, util: 88 },
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 0, util: 85 },
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 0, util: 82 },
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 1, util: 90 },
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 1, util: 87 },
      { type: 'SHIP_TO_SHORE', cap: 32, status: 'ACTIVE', berth: 1, util: 84 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE', berth: 2, util: 78 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE', berth: 3, util: 82 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE', berth: 4, util: 71 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 20, status: 'ACTIVE', berth: null, util: 65 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 20, status: 'IDLE',   berth: null, util: 10 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 20, status: 'IDLE',   berth: null, util: 0  },
    ],
    T3: [
      // Scenario 3 — crane shortfall: 4 cranes in maintenance
      { type: 'SHIP_TO_SHORE', cap: 30, status: 'ACTIVE',      berth: 0, util: 92 },
      { type: 'SHIP_TO_SHORE', cap: 30, status: 'ACTIVE',      berth: 0, util: 88 },
      { type: 'SHIP_TO_SHORE', cap: 30, status: 'ACTIVE',      berth: 1, util: 95 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE',      berth: 2, util: 85 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'ACTIVE',      berth: 3, util: 80 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'MAINTENANCE', berth: null, util: 0 },
      { type: 'SHIP_TO_SHORE', cap: 28, status: 'MAINTENANCE', berth: null, util: 0 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 20, status: 'MAINTENANCE', berth: null, util: 0 },
      { type: 'RUBBER_TIRED_GANTRY', cap: 20, status: 'MAINTENANCE', berth: null, util: 0 },
    ],
  };

  const defs = craneDefs[tc];
  defs.forEach((d, i) => {
    const berthDoc = d.berth !== null ? berthDocs[d.berth] : null;
    cranes.push({
      craneId: `C${i + 1}-${tc}`,
      terminalId: tid,
      terminalCode: tc,
      berthId: berthDoc ? berthDoc._id : null,
      name: `${tc} Crane ${i + 1}`,
      type: d.type,
      status: d.status,
      assignedVesselId: null,
      liftCapacityTEUPerHour: d.cap,
      maxLiftWeightTonnes: d.type === 'SHIP_TO_SHORE' ? 65 : 45,
      utilizationPercent: d.util,
      yearInstalled: rand(2010, 2022),
      isDemoData: true,
    });
  });

  return cranes;
}

// ─── 4. VESSELS ───────────────────────────────────────────────────────────────

const SHIPPING_LINES = ['Maersk', 'MSC', 'CMA CGM', 'COSCO', 'Evergreen', 'Hapag-Lloyd', 'ONE', 'Yang Ming'];
const FLAGS = ['SG', 'PA', 'LR', 'BS', 'MT', 'CY', 'MH'];
const CARGO_TYPES = ['IMPORT', 'EXPORT', 'TRANSHIPMENT', 'MIXED'];

const VESSEL_NAMES = [
  'Horizon Star', 'Pacific Voyager', 'Ocean Titan', 'Atlantic Breeze', 'Nordic Spirit',
  'Eastern Dawn', 'Golden Gate', 'Silver Stream', 'Blue Horizon', 'Coral Sea',
  'Iron Phoenix', 'Jade Dragon', 'Emerald Wave', 'Ruby Crest', 'Sapphire Reef',
  'Thunder Bay', 'Arctic Wind', 'Storm Rider', 'Sun Carrier', 'Moon Navigator',
  'Delta Force', 'Alpha Prime', 'Beta Star', 'Gamma Ray', 'Epsilon Bridge',
  'Pioneer One', 'Trailblazer', 'Frontrunner', 'Pathfinder', 'Trident',
  'Vanguard', 'Sentinel', 'Guardian', 'Champion', 'Defender',
  'Olympia', 'Titan Express', 'Velocity', 'Momentum', 'Legacy',
  'Discovery', 'Endeavour', 'Resolution', 'Enterprise', 'Challenger',
  'Meridian', 'Zenith', 'Apex', 'Pinnacle', 'Summit',
];

/**
 * Build 50 vessels across the 3 terminals.
 * Deliberately creates the 6 demo scenarios.
 *
 * Scenario mapping:
 *  T1 (LOW):      15 vessels, spread arrivals, LOW risk
 *  T2 (HIGH):     20 vessels, clustering arrivals, HIGH risk, berth competition
 *  T3 (CRITICAL): 15 vessels, high queue, crane shortfall, CRITICAL risk
 */
function makeVessels(terminalDocs, berthDocs) {
  const vessels = [];
  const now = NOW;

  // Helper: find berths for a terminal code
  const berthsForTerminal = (tc) => berthDocs.filter(b => b.terminalCode === tc);

  // ── T1 vessels (15) ─────────────────────────────────────────
  const t1 = terminalDocs.find(t => t.terminalId === 'T1');
  const t1Berths = berthsForTerminal('T1');

  const t1Vessels = [
    // Normal operating vessels — AT_BERTH
    { id:'V-101', name:'Horizon Star',    teu:8500,  status:'AT_BERTH',  berthIdx:0, arrival:addHours(now,-18), dep:addHours(now,6),  risk:'LOW',    riskScore:0.22, waiting:0,   priority:'MEDIUM', cranes:3 },
    { id:'V-102', name:'Pacific Voyager', teu:5200,  status:'AT_BERTH',  berthIdx:1, arrival:addHours(now,-12), dep:addHours(now,8),  risk:'LOW',    riskScore:0.18, waiting:0,   priority:'LOW',    cranes:2 },
    { id:'V-103', name:'Ocean Titan',     teu:3800,  status:'AT_BERTH',  berthIdx:3, arrival:addHours(now,-6),  dep:addHours(now,10), risk:'LOW',    riskScore:0.15, waiting:0,   priority:'LOW',    cranes:1 },
    // INBOUND — normal queue
    { id:'V-104', name:'Atlantic Breeze', teu:6200,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,3),  dep:addHours(now,21), risk:'LOW',    riskScore:0.20, waiting:1,   priority:'MEDIUM', cranes:2 },
    { id:'V-105', name:'Nordic Spirit',   teu:4400,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,5),  dep:addHours(now,23), risk:'LOW',    riskScore:0.17, waiting:1.5, priority:'LOW',    cranes:2 },
    { id:'V-106', name:'Eastern Dawn',    teu:2800,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,8),  dep:addHours(now,26), risk:'LOW',    riskScore:0.12, waiting:0,   priority:'LOW',    cranes:1 },
    { id:'V-107', name:'Golden Gate',     teu:5600,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,12), dep:addHours(now,30), risk:'LOW',    riskScore:0.19, waiting:0,   priority:'MEDIUM', cranes:2 },
    { id:'V-108', name:'Silver Stream',   teu:3200,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,16), dep:addHours(now,34), risk:'LOW',    riskScore:0.14, waiting:0,   priority:'LOW',    cranes:1 },
    // Departed
    { id:'V-109', name:'Blue Horizon',    teu:7000,  status:'DEPARTED',  berthIdx:null, arrival:addHours(now,-48), dep:addHours(now,-24), risk:'LOW',  riskScore:0.10, waiting:0,   priority:'MEDIUM', cranes:2 },
    { id:'V-110', name:'Coral Sea',       teu:4500,  status:'DEPARTED',  berthIdx:null, arrival:addHours(now,-36), dep:addHours(now,-12), risk:'LOW',  riskScore:0.10, waiting:0,   priority:'LOW',    cranes:2 },
    // Waiting (minor)
    { id:'V-111', name:'Iron Phoenix',    teu:5800,  status:'WAITING',   berthIdx:null, arrival:addHours(now,-2),  dep:addHours(now,16), risk:'MEDIUM', riskScore:0.42, waiting:3,  priority:'MEDIUM', cranes:2 },
    { id:'V-112', name:'Jade Dragon',     teu:9200,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,20), dep:addHours(now,40), risk:'LOW',    riskScore:0.21, waiting:0,   priority:'HIGH',   cranes:3 },
    { id:'V-113', name:'Emerald Wave',    teu:3600,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,24), dep:addHours(now,42), risk:'LOW',    riskScore:0.13, waiting:0,   priority:'LOW',    cranes:1 },
    { id:'V-114', name:'Ruby Crest',      teu:6400,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,30), dep:addHours(now,50), risk:'LOW',    riskScore:0.18, waiting:0,   priority:'MEDIUM', cranes:2 },
    { id:'V-115', name:'Sapphire Reef',   teu:4800,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,36), dep:addHours(now,56), risk:'LOW',    riskScore:0.16, waiting:0,   priority:'LOW',    cranes:2 },
  ];

  // ── T2 vessels (20) — HIGH congestion, berth competition ────
  const t2 = terminalDocs.find(t => t.terminalId === 'T2');
  const t2Berths = berthsForTerminal('T2');

  const t2Vessels = [
    // AT_BERTH — all 5 occupied berths full
    { id:'V-201', name:'Thunder Bay',     teu:16000, status:'AT_BERTH',  berthIdx:0, arrival:addHours(now,-20), dep:addHours(now,4),  risk:'HIGH',   riskScore:0.71, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-202', name:'Arctic Wind',     teu:14500, status:'AT_BERTH',  berthIdx:1, arrival:addHours(now,-16), dep:addHours(now,8),  risk:'HIGH',   riskScore:0.68, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-203', name:'Storm Rider',     teu:12000, status:'AT_BERTH',  berthIdx:2, arrival:addHours(now,-14), dep:addHours(now,6),  risk:'MEDIUM', riskScore:0.58, waiting:0,   priority:'MEDIUM', cranes:3 },
    { id:'V-204', name:'Sun Carrier',     teu:13500, status:'AT_BERTH',  berthIdx:3, arrival:addHours(now,-10), dep:addHours(now,10), risk:'HIGH',   riskScore:0.72, waiting:0,   priority:'HIGH',   cranes:3 },
    { id:'V-205', name:'Moon Navigator',  teu:8000,  status:'AT_BERTH',  berthIdx:4, arrival:addHours(now,-8),  dep:addHours(now,12), risk:'MEDIUM', riskScore:0.55, waiting:0,   priority:'MEDIUM', cranes:2 },
    // WAITING — Scenario 5: multiple vessels competing for 1 remaining berth
    { id:'V-206', name:'Delta Force',     teu:14000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-4),  dep:addHours(now,16), risk:'HIGH',   riskScore:0.76, waiting:4,   priority:'HIGH',   cranes:4 },
    { id:'V-207', name:'Alpha Prime',     teu:18000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-3),  dep:addHours(now,17), risk:'HIGH',   riskScore:0.78, waiting:3,   priority:'HIGH',   cranes:4 },
    { id:'V-208', name:'Beta Star',       teu:12500, status:'WAITING',   berthIdx:null, arrival:addHours(now,-2),  dep:addHours(now,18), risk:'HIGH',   riskScore:0.74, waiting:2,   priority:'MEDIUM', cranes:3 },
    // INBOUND — arriving into congestion
    { id:'V-209', name:'Gamma Ray',       teu:16500, status:'INBOUND',   berthIdx:null, arrival:addHours(now,2),   dep:addHours(now,22), risk:'HIGH',   riskScore:0.73, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-210', name:'Epsilon Bridge',  teu:9500,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,3),   dep:addHours(now,21), risk:'HIGH',   riskScore:0.69, waiting:0,   priority:'MEDIUM', cranes:3 },
    { id:'V-211', name:'Pioneer One',     teu:13000, status:'INBOUND',   berthIdx:null, arrival:addHours(now,4),   dep:addHours(now,24), risk:'HIGH',   riskScore:0.70, waiting:0,   priority:'HIGH',   cranes:3 },
    { id:'V-212', name:'Trailblazer',     teu:14500, status:'INBOUND',   berthIdx:null, arrival:addHours(now,5),   dep:addHours(now,25), risk:'HIGH',   riskScore:0.72, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-213', name:'Frontrunner',     teu:8500,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,6),   dep:addHours(now,24), risk:'MEDIUM', riskScore:0.56, waiting:0,   priority:'MEDIUM', cranes:2 },
    // More inbound after shift
    { id:'V-214', name:'Pathfinder',      teu:10000, status:'INBOUND',   berthIdx:null, arrival:addHours(now,8),   dep:addHours(now,28), risk:'HIGH',   riskScore:0.68, waiting:0,   priority:'MEDIUM', cranes:3 },
    { id:'V-215', name:'Trident',         teu:15500, status:'INBOUND',   berthIdx:null, arrival:addHours(now,10),  dep:addHours(now,30), risk:'HIGH',   riskScore:0.74, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-216', name:'Vanguard',        teu:12000, status:'INBOUND',   berthIdx:null, arrival:addHours(now,12),  dep:addHours(now,32), risk:'HIGH',   riskScore:0.67, waiting:0,   priority:'HIGH',   cranes:3 },
    // Departed
    { id:'V-217', name:'Sentinel',        teu:14000, status:'DEPARTED',  berthIdx:null, arrival:addHours(now,-48), dep:addHours(now,-24), risk:'LOW',  riskScore:0.10, waiting:8,   priority:'HIGH',   cranes:4 },
    { id:'V-218', name:'Guardian',        teu:16000, status:'DEPARTED',  berthIdx:null, arrival:addHours(now,-36), dep:addHours(now,-12), risk:'LOW',  riskScore:0.10, waiting:12,  priority:'HIGH',   cranes:4 },
    // Delayed — Scenario 6: schedule conflict, vessel delayed
    { id:'V-219', name:'Champion',        teu:13000, status:'DELAYED',   berthIdx:null, arrival:addHours(now,-1),  dep:addHours(now,21), risk:'HIGH',   riskScore:0.77, waiting:6,   priority:'HIGH',   cranes:3 },
    { id:'V-220', name:'Defender',        teu:9500,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,7),   dep:addHours(now,25), risk:'MEDIUM', riskScore:0.60, waiting:0,   priority:'MEDIUM', cranes:3 },
  ];

  // ── T3 vessels (15) — CRITICAL congestion, crane shortfall ──
  const t3 = terminalDocs.find(t => t.terminalId === 'T3');
  const t3Berths = berthsForTerminal('T3');

  const t3Vessels = [
    // AT_BERTH — all 5 occupied berths completely full
    { id:'V-301', name:'Olympia',         teu:15000, status:'AT_BERTH',  berthIdx:0, arrival:addHours(now,-24), dep:addHours(now,6),  risk:'CRITICAL', riskScore:0.89, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-302', name:'Titan Express',   teu:15000, status:'AT_BERTH',  berthIdx:1, arrival:addHours(now,-20), dep:addHours(now,4),  risk:'CRITICAL', riskScore:0.91, waiting:0,   priority:'HIGH',   cranes:4 },
    { id:'V-303', name:'Velocity',        teu:10000, status:'AT_BERTH',  berthIdx:2, arrival:addHours(now,-16), dep:addHours(now,8),  risk:'HIGH',     riskScore:0.82, waiting:0,   priority:'HIGH',   cranes:3 },
    { id:'V-304', name:'Momentum',        teu:8000,  status:'AT_BERTH',  berthIdx:3, arrival:addHours(now,-12), dep:addHours(now,12), risk:'HIGH',     riskScore:0.81, waiting:0,   priority:'MEDIUM', cranes:2 },
    { id:'V-305', name:'Legacy',          teu:6000,  status:'AT_BERTH',  berthIdx:4, arrival:addHours(now,-8),  dep:addHours(now,10), risk:'HIGH',     riskScore:0.80, waiting:0,   priority:'MEDIUM', cranes:2 },
    // WAITING — large queue
    { id:'V-306', name:'Discovery',       teu:15500, status:'WAITING',   berthIdx:null, arrival:addHours(now,-6),  dep:addHours(now,18), risk:'CRITICAL', riskScore:0.92, waiting:6,   priority:'HIGH',   cranes:4 },
    { id:'V-307', name:'Endeavour',       teu:12000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-4),  dep:addHours(now,20), risk:'CRITICAL', riskScore:0.88, waiting:4,   priority:'HIGH',   cranes:3 },
    { id:'V-308', name:'Resolution',      teu:16000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-3),  dep:addHours(now,21), risk:'CRITICAL', riskScore:0.95, waiting:3,   priority:'HIGH',   cranes:4 },
    // Scenario 4: V-309 requires 4 cranes, only 2 active available → crane shortfall
    { id:'V-309', name:'Enterprise',      teu:18000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-2),  dep:addHours(now,22), risk:'CRITICAL', riskScore:0.97, waiting:2,   priority:'HIGH',   cranes:4 },
    { id:'V-310', name:'Challenger',      teu:14000, status:'WAITING',   berthIdx:null, arrival:addHours(now,-1),  dep:addHours(now,23), risk:'CRITICAL', riskScore:0.90, waiting:1,   priority:'HIGH',   cranes:3 },
    // INBOUND — arriving into CRITICAL situation
    { id:'V-311', name:'Meridian',        teu:13500, status:'INBOUND',   berthIdx:null, arrival:addHours(now,1),   dep:addHours(now,25), risk:'CRITICAL', riskScore:0.88, waiting:0,   priority:'HIGH',   cranes:3 },
    { id:'V-312', name:'Zenith',          teu:10500, status:'INBOUND',   berthIdx:null, arrival:addHours(now,3),   dep:addHours(now,27), risk:'CRITICAL', riskScore:0.85, waiting:0,   priority:'MEDIUM', cranes:3 },
    { id:'V-313', name:'Apex',            teu:9000,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,5),   dep:addHours(now,29), risk:'HIGH',     riskScore:0.82, waiting:0,   priority:'MEDIUM', cranes:2 },
    { id:'V-314', name:'Pinnacle',        teu:8500,  status:'INBOUND',   berthIdx:null, arrival:addHours(now,7),   dep:addHours(now,31), risk:'HIGH',     riskScore:0.80, waiting:0,   priority:'MEDIUM', cranes:2 },
    // Departed
    { id:'V-315', name:'Summit',          teu:14500, status:'DEPARTED',  berthIdx:null, arrival:addHours(now,-72), dep:addHours(now,-48), risk:'LOW',    riskScore:0.10, waiting:14,  priority:'HIGH',   cranes:4 },
  ];

  // Compile all vessels with terminal references resolved
  function buildVesselDocs(defs, terminal, berths) {
    return defs.map((v, idx) => {
      const berthDoc = v.berthIdx !== null ? berths[v.berthIdx] : null;
      return {
        vesselId: v.id,
        vesselName: v.name,
        imoNumber: `IMO${9000000 + parseInt(v.id.split('-')[1]) + parseInt(terminal.terminalId.slice(1)) * 1000}`,
        vesselType: 'CONTAINER',
        sizeTEU: v.teu,
        lengthOverallM: Math.round(150 + v.teu * 0.013),
        maxDraftM: v.teu >= 12000 ? 16 : v.teu >= 8000 ? 14 : 12,
        flag: pick(FLAGS),
        shippingLine: pick(SHIPPING_LINES),
        arrivalTime: v.arrival,
        estimatedDeparture: v.dep,
        actualArrival: ['AT_BERTH', 'WAITING', 'DEPARTED', 'DELAYED'].includes(v.status) ? v.arrival : null,
        actualDeparture: v.status === 'DEPARTED' ? v.dep : null,
        terminalId: terminal._id,
        terminalCode: terminal.terminalId,
        assignedBerthId: berthDoc ? berthDoc._id : null,
        status: v.status,
        priority: v.priority,
        cargoType: pick(CARGO_TYPES),
        waitingHours: v.waiting,
        estimatedProcessingHours: Math.ceil(v.teu / 300),
        congestionRisk: v.risk,
        congestionRiskScore: v.riskScore,
        requiredCranes: v.cranes,
        assignedCraneIds: [],
        isDemoData: true,
      };
    });
  }

  vessels.push(...buildVesselDocs(t1Vessels, t1, t1Berths));
  vessels.push(...buildVesselDocs(t2Vessels, t2, t2Berths));
  vessels.push(...buildVesselDocs(t3Vessels, t3, t3Berths));

  return vessels;
}

// ─── 5. SCHEDULES ─────────────────────────────────────────────────────────────

function makeSchedules(vesselDocs, terminalDocs, berthDocs) {
  const schedules = [];
  let idx = 1;

  // Generate schedules only for non-departed vessels (and some recent arrivals for history)
  const relevant = vesselDocs.filter(v => v.status !== 'DEPARTED');

  for (const v of relevant) {
    const terminal = terminalDocs.find(t => t._id.equals(v.terminalId));
    const berth = v.assignedBerthId
      ? berthDocs.find(b => b._id.equals(v.assignedBerthId))
      : null;

    // Status mapping
    const schedStatus =
      v.status === 'AT_BERTH'   ? 'ACTIVE'    :
      v.status === 'WAITING'    ? 'ACTIVE'    :
      v.status === 'DELAYED'    ? 'DELAYED'   :
      v.status === 'INBOUND'    ? 'SCHEDULED' : 'SCHEDULED';

    const delayHrs = v.status === 'DELAYED' ? rand(4, 8) : 0;

    schedules.push({
      scheduleId: `SCH-${String(idx).padStart(4, '0')}`,
      vesselId: v._id,
      vesselCode: v.vesselId,
      vesselName: v.vesselName,
      terminalId: terminal._id,
      terminalCode: terminal.terminalId,
      berthId: berth ? berth._id : null,
      berthCode: berth ? berth.berthId : null,
      plannedArrival: v.arrivalTime,
      plannedDeparture: v.estimatedDeparture,
      actualArrival: v.actualArrival,
      actualDeparture: null,
      estimatedArrival: addHours(v.arrivalTime, -delayHrs),
      processingHoursEstimate: v.estimatedProcessingHours,
      teuToProcess: v.sizeTEU,
      craneAssignments: [],
      requiredCranes: v.requiredCranes,
      status: schedStatus,
      delayHours: delayHrs,
      delayReason: delayHrs > 0 ? 'BERTH_UNAVAILABLE' : null,
      priority: v.priority,
      isDemoData: true,
    });
    idx++;
  }

  return schedules;
}

// ─── 6. HISTORICAL OPERATIONS (90 days) ──────────────────────────────────────

function makeHistoricalOperations(terminalDocs) {
  const records = [];

  // Base patterns per terminal — realistic 90-day trend
  const patterns = {
    T1: { baseVessels: 8, baseWait: 2.5, baseBerthUtil: 42, baseCraneUtil: 48, baseTEU: 9000, trend: 0.01 },
    T2: { baseVessels: 12, baseWait: 5.2, baseBerthUtil: 65, baseCraneUtil: 72, baseTEU: 16000, trend: 0.05 },
    T3: { baseVessels: 10, baseWait: 8.1, baseBerthUtil: 78, baseCraneUtil: 80, baseTEU: 13000, trend: 0.08 },
  };

  for (const terminal of terminalDocs) {
    const p = patterns[terminal.terminalId];

    for (let d = 89; d >= 0; d--) {
      const date = subtractDays(NOW, d);
      date.setHours(0, 0, 0, 0);

      // Day-of-week effect: weekends slightly quieter
      const dow = date.getDay(); // 0=Sun, 6=Sat
      const weekendFactor = (dow === 0 || dow === 6) ? 0.80 : 1.0;
      // Trend: congestion increases toward "today" for T2 and T3
      const dayRatio = (90 - d) / 90;
      const trendFactor = 1 + p.trend * dayRatio * 30;

      const vesselCount = Math.round(clamp(p.baseVessels * trendFactor * weekendFactor + rand(-2, 2), 3, 20));
      const berthUtil = clamp(p.baseBerthUtil * trendFactor + rand(-5, 5), 10, 100);
      const craneUtil = clamp(p.baseCraneUtil * trendFactor + rand(-6, 6), 10, 100);
      const avgWait = clamp(p.baseWait * trendFactor + randFloat(-1, 1), 0, 24);
      const teu = Math.round(p.baseTEU * trendFactor * weekendFactor + rand(-500, 500));
      const congEvents = berthUtil > 85 ? rand(1, 4) : berthUtil > 70 ? rand(0, 2) : 0;
      const level =
        berthUtil >= 88 ? 'CRITICAL' :
        berthUtil >= 72 ? 'HIGH'     :
        berthUtil >= 50 ? 'MEDIUM'   :
        berthUtil >= 25 ? 'LOW'      : 'NONE';

      // Occasional disruption event
      const disruption = Math.random() < 0.04;

      records.push({
        date,
        terminalId: terminal._id,
        terminalCode: terminal.terminalId,
        vesselCount,
        vesselArrivals: Math.round(vesselCount * 0.6),
        vesselDepartures: Math.round(vesselCount * 0.55),
        largeVesselCount: Math.round(vesselCount * 0.3),
        avgWaitingHours: parseFloat(avgWait.toFixed(1)),
        maxWaitingHours: parseFloat((avgWait * 2.2).toFixed(1)),
        totalProcessingHours: Math.round(vesselCount * 18),
        avgBerthUtilizationPercent: Math.round(berthUtil),
        peakBerthUtilizationPercent: Math.min(100, Math.round(berthUtil + rand(3, 12))),
        avgCraneUtilizationPercent: Math.round(craneUtil),
        totalTEUProcessed: teu,
        congestionEvents: congEvents,
        congestionLevel: level,
        peakArrivalHour: pick([6, 7, 8, 9, 14, 15, 16]),
        operationalDisruption: disruption,
        disruptionNote: disruption ? pick(['Equipment breakdown', 'Weather delay', 'Vessel late departure', 'Berth maintenance']) : null,
        isDemoData: true,
      });
    }
  }

  return records;
}

// ─── 7. CONGESTION PREDICTIONS ────────────────────────────────────────────────

function makeCongestionPredictions(terminalDocs, berthDocs) {
  const preds = [];
  const horizons = ['6H', '12H', '24H', '72H'];
  let idx = 1;

  // Per-terminal, per-horizon predictions
  const predConfigs = {
    T1: {
      '6H':  { score:0.22, wait:1.5, queueForecast:2, berthUtil:0.42 },
      '12H': { score:0.28, wait:2.0, queueForecast:3, berthUtil:0.45 },
      '24H': { score:0.31, wait:2.5, queueForecast:4, berthUtil:0.48 },
      '72H': { score:0.25, wait:2.0, queueForecast:3, berthUtil:0.44 },
    },
    T2: {
      '6H':  { score:0.71, wait:9.0,  queueForecast:8,  berthUtil:0.88 },
      '12H': { score:0.75, wait:12.0, queueForecast:10, berthUtil:0.91 },
      '24H': { score:0.68, wait:10.0, queueForecast:9,  berthUtil:0.86 },
      '72H': { score:0.62, wait:8.0,  queueForecast:7,  berthUtil:0.82 },
    },
    T3: {
      '6H':  { score:0.92, wait:18.0, queueForecast:10, berthUtil:0.96 },
      '12H': { score:0.95, wait:22.0, queueForecast:11, berthUtil:0.98 },
      '24H': { score:0.88, wait:16.0, queueForecast:9,  berthUtil:0.94 },
      '72H': { score:0.80, wait:14.0, queueForecast:8,  berthUtil:0.90 },
    },
  };

  // Factor distributions per scenario (must sum to ~congestionScore)
  const factorConfigs = {
    T1: { berthUtil:0.08, vesselQueue:0.05, arrivalRate:0.05, craneShortfall:0.02, largeVessel:0.02 },
    T2: { berthUtil:0.26, vesselQueue:0.18, arrivalRate:0.13, craneShortfall:0.08, largeVessel:0.06 },
    T3: { berthUtil:0.28, vesselQueue:0.23, arrivalRate:0.18, craneShortfall:0.15, largeVessel:0.08 },
  };

  for (const terminal of terminalDocs) {
    const tc = terminal.terminalId;
    const configs = predConfigs[tc];
    const factors = factorConfigs[tc];
    const affectedBerths = berthDocs.filter(b => b.terminalCode === tc && b.currentStatus === 'OCCUPIED');

    for (const horizon of horizons) {
      const cfg = configs[horizon];

      preds.push({
        predictionId: `PRED-${String(idx).padStart(4, '0')}`,
        terminalId: terminal._id,
        terminalCode: tc,
        terminalName: terminal.name,
        horizon,
        generatedAt: addHours(NOW, -1), // generated 1 hour ago
        validUntil: addHours(NOW, 2),
        congestionScore: cfg.score,
        riskLevel: riskLevel(cfg.score),
        predictedWaitingHours: cfg.wait,
        berthUtilizationForecast: cfg.berthUtil,
        vesselQueueForecast: cfg.queueForecast,
        factorInputs: {
          berthUtilizationFactor: factors.berthUtil / 0.30,
          vesselQueueFactor: factors.vesselQueue / 0.25,
          arrivalRateFactor: factors.arrivalRate / 0.20,
          craneShortfallFactor: factors.craneShortfall / 0.15,
          largeVesselFactor: factors.largeVessel / 0.10,
        },
        contributingFactors: [
          { factor: 'HIGH_BERTH_UTILIZATION', weight: factors.berthUtil / cfg.score, value: cfg.berthUtil, description: `Berth utilization forecast ${Math.round(cfg.berthUtil * 100)}%` },
          { factor: 'HIGH_VESSEL_QUEUE', weight: factors.vesselQueue / cfg.score, value: cfg.queueForecast, description: `${cfg.queueForecast} vessels in queue` },
          { factor: 'HIGH_ARRIVAL_RATE', weight: factors.arrivalRate / cfg.score, value: cfg.queueForecast, description: `${cfg.queueForecast} vessels expected in window` },
          { factor: 'CRANE_SHORTFALL', weight: factors.craneShortfall / cfg.score, value: tc === 'T3' ? 4 : 0, description: tc === 'T3' ? '4 cranes in maintenance' : 'Crane capacity adequate' },
          { factor: 'LARGE_VESSEL_CONCENTRATION', weight: factors.largeVessel / cfg.score, value: Math.round(cfg.queueForecast * 0.4), description: `${Math.round(cfg.queueForecast * 0.4)} large vessels (≥8000 TEU)` },
        ],
        affectedBerthIds: affectedBerths.map(b => b._id),
        modelType: 'ANALYTICAL_SCORING',
        confidence: tc === 'T1' ? 0.85 : tc === 'T2' ? 0.80 : 0.78,
        dataLabel: 'SYNTHETIC DEMO DATA — NOT REAL PORT DATA',
        isDemoData: true,
      });
      idx++;
    }
  }

  return preds;
}

// ─── 8. RECOMMENDATIONS ──────────────────────────────────────────────────────

function makeRecommendations(terminalDocs, vesselDocs, berthDocs) {
  const recs = [];
  let idx = 1;

  const t2 = terminalDocs.find(t => t.terminalId === 'T2');
  const t3 = terminalDocs.find(t => t.terminalId === 'T3');
  const t2Berths = berthDocs.filter(b => b.terminalCode === 'T2');
  const t3Berths = berthDocs.filter(b => b.terminalCode === 'T3');

  // Find key vessels by ID
  const findV = (id) => vesselDocs.find(v => v.vesselId === id);

  // Rec 1: Berth reallocation — V-207 (18000 TEU waiting T2) → use berth B1-T2 when freed
  const v207 = findV('V-207');
  if (v207) {
    recs.push({
      recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
      type: 'BERTH_REALLOCATION',
      terminalId: t2._id, terminalCode: 'T2',
      vesselId: v207._id, vesselCode: 'V-207',
      currentBerthId: null,
      recommendedBerthId: t2Berths[0]._id,
      currentCraneIds: [], recommendedCraneIds: [],
      reason: 'V-207 (Gamma Ray, 18000 TEU) is waiting. Berth B1-T2 becomes available in 4 hours. Pre-assign to reduce port stay by 3 hours.',
      expectedBenefitHours: 3.0,
      expectedBenefitDescription: 'Reduces vessel waiting time from 7H to 4H',
      priority: 'HIGH', confidence: 0.83, status: 'PENDING',
      generatedAt: addHours(NOW, -0.5), isDemoData: true,
    });
  }

  // Rec 2: Crane reassignment — T3 needs crane redeployment from T1
  recs.push({
    recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
    type: 'CRANE_ADDITION',
    terminalId: t3._id, terminalCode: 'T3',
    vesselId: null, vesselCode: null,
    currentBerthId: null, recommendedBerthId: null,
    currentCraneIds: [], recommendedCraneIds: [],
    reason: 'T3 has 4 cranes in maintenance with 5 vessels waiting. Redeploy 1 mobile harbour crane from T1 (utilization 45%) to T3 to partially address shortfall.',
    expectedBenefitHours: 4.5,
    expectedBenefitDescription: 'Increases T3 crane capacity by ~20%, reducing queue wait by estimated 4-5 hours',
    priority: 'CRITICAL', confidence: 0.79, status: 'PENDING',
    generatedAt: addHours(NOW, -0.5), isDemoData: true,
  });

  // Rec 3: Vessel delay recommendation for V-308 (T3, 16000 TEU)
  const v308 = findV('V-308');
  if (v308) {
    recs.push({
      recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
      type: 'VESSEL_DELAY',
      terminalId: t3._id, terminalCode: 'T3',
      vesselId: v308._id, vesselCode: 'V-308',
      currentBerthId: null, recommendedBerthId: null,
      currentCraneIds: [], recommendedCraneIds: [],
      reason: 'V-308 (Resolution, 16000 TEU) is 3rd in queue at T3. Recommend delaying arrival by 6 hours to reduce peak congestion and align with berth availability window.',
      expectedBenefitHours: 2.0,
      expectedBenefitDescription: 'Distributes arrival load, reduces peak waiting queue from 5 to 3 vessels',
      priority: 'HIGH', confidence: 0.77, status: 'PENDING',
      generatedAt: addHours(NOW, -0.5), isDemoData: true,
    });
  }

  // Rec 4: Rerouting — V-309 (18000 TEU) reroute from T3 to T2 (larger berth capacity)
  const v309 = findV('V-309');
  if (v309) {
    recs.push({
      recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
      type: 'REROUTING',
      terminalId: t3._id, terminalCode: 'T3',
      vesselId: v309._id, vesselCode: 'V-309',
      currentBerthId: null, recommendedBerthId: t2Berths[1]._id,
      currentCraneIds: [], recommendedCraneIds: [],
      reason: 'V-309 (Enterprise, 18000 TEU) requires 4 cranes. T3 has only 5 active cranes total with 5 vessels at berth. Rerouting to T2-B2 (18000 TEU capacity, 4 cranes available within 8H) reduces waiting from 22H to 9H.',
      expectedBenefitHours: 13.0,
      expectedBenefitDescription: 'Reduces V-309 port stay by 13 hours; reduces T3 queue by 1 large vessel',
      priority: 'HIGH', confidence: 0.75, status: 'PENDING',
      generatedAt: addHours(NOW, -0.5), isDemoData: true,
    });
  }

  // Rec 5: Berth reallocation — V-219 delayed at T2 (schedule conflict)
  const v219 = findV('V-219');
  if (v219) {
    recs.push({
      recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
      type: 'SCHEDULE_ADJUSTMENT',
      terminalId: t2._id, terminalCode: 'T2',
      vesselId: v219._id, vesselCode: 'V-219',
      currentBerthId: null, recommendedBerthId: null,
      currentCraneIds: [], recommendedCraneIds: [],
      reason: 'V-219 (Champion) is delayed 6H due to berth conflict with V-201 overrun. Adjust schedule window by 8 hours to resolve conflict and align crane availability.',
      expectedBenefitHours: 2.5,
      expectedBenefitDescription: 'Resolves schedule conflict, enables planned crane assignment',
      priority: 'HIGH', confidence: 0.82, status: 'PENDING',
      generatedAt: addHours(NOW, -0.5), isDemoData: true,
    });
  }

  // Rec 6: Already accepted recommendation (for UI history)
  recs.push({
    recommendationId: `REC-${String(idx++).padStart(4,'0')}`,
    type: 'BERTH_REALLOCATION',
    terminalId: t2._id, terminalCode: 'T2',
    vesselId: null, vesselCode: null,
    currentBerthId: null, recommendedBerthId: null,
    currentCraneIds: [], recommendedCraneIds: [],
    reason: 'Previously recommended reassignment of V-217 (Sentinel) to B5-T2 — accepted and executed 24H ago.',
    expectedBenefitHours: 3.0,
    expectedBenefitDescription: 'Saved 3 hours waiting time (completed)',
    priority: 'MEDIUM', confidence: 0.88, status: 'ACCEPTED',
    generatedAt: addHours(NOW, -25), isDemoData: true,
  });

  return recs;
}

// ─── 9. ALERTS ────────────────────────────────────────────────────────────────

function makeAlerts(terminalDocs, vesselDocs, berthDocs) {
  const alerts = [];
  let idx = 1;

  const t2 = terminalDocs.find(t => t.terminalId === 'T2');
  const t3 = terminalDocs.find(t => t.terminalId === 'T3');
  const t1 = terminalDocs.find(t => t.terminalId === 'T1');
  const findV = (id) => vesselDocs.find(v => v.vesselId === id);

  const alertDefs = [
    { type:'CONGESTION_RISK',   sev:'CRITICAL', tc:'T3', t:t3, vid:'V-309', msg:'CRITICAL: Terminal 3 congestion probability 95% (12H horizon). 5 vessels in queue. Immediate action required.', details:'Berth utilization 96%, 4 cranes in maintenance, 5 vessels waiting.' },
    { type:'CONGESTION_RISK',   sev:'HIGH',     tc:'T3', t:t3, vid:'V-308', msg:'HIGH: Terminal 3 vessel queue exceeds capacity. 5 vessels waiting, berth utilization 96%.', details:'Queue will not clear for 22+ hours without intervention.' },
    { type:'CRANE_SHORTAGE',    sev:'CRITICAL', tc:'T3', t:t3, vid:null,    msg:'CRITICAL: Terminal 3 crane shortage. 4 cranes in maintenance. Only 5 active cranes for 5 berths.', details:'Required capacity: 14 cranes. Available: 5. Shortfall: 9.' },
    { type:'CONGESTION_RISK',   sev:'HIGH',     tc:'T2', t:t2, vid:null,    msg:'HIGH: Terminal 2 berth utilization at 88%. 3 vessels waiting, 8 more inbound in next 6H.', details:'Current berth utilization trending toward critical threshold.' },
    { type:'VESSEL_DELAY',      sev:'HIGH',     tc:'T2', t:t2, vid:'V-219', msg:'HIGH: V-219 Champion delayed 6 hours at Terminal 2 due to schedule conflict.', details:'Berth conflict with V-201 overrun. Estimated impact: 4 downstream vessels.' },
    { type:'BERTH_CONFLICT',    sev:'HIGH',     tc:'T2', t:t2, vid:'V-207', msg:'HIGH: Berth conflict detected at T2-B1. V-207 (Alpha Prime) and V-209 scheduled within 2H window.', details:'V-207 arrival 03:00, V-209 planned 05:00. Insufficient processing time for B1.' },
    { type:'CAPACITY_EXCEEDED', sev:'CRITICAL', tc:'T3', t:t3, vid:null,    msg:'CRITICAL: Terminal 3 TEU capacity at 93%. Current load 14,900 / 16,000 TEU.', details:'At current arrival rate, capacity will reach 100% within 4 hours.' },
    { type:'SCHEDULE_CONFLICT', sev:'HIGH',     tc:'T2', t:t2, vid:'V-206', msg:'HIGH: V-206 (Delta Force) and V-215 (Trident) both scheduled for B2-T2 in overlapping windows.', details:'B2-T2 available from 08:00. V-206 needs 20H processing. V-215 arrives 10:00.' },
    { type:'CONGESTION_RISK',   sev:'WARNING',  tc:'T1', t:t1, vid:null,    msg:'WARNING: Terminal 1 vessel queue growing. 4 inbound vessels in next 12H with 2 berths occupied.', details:'Minor queue expected. Monitor over next 6 hours.' },
    { type:'MAINTENANCE_ALERT', sev:'WARNING',  tc:'T3', t:t3, vid:null,    msg:'WARNING: Terminal 3 crane maintenance extended. C6-T3 to C9-T3 remain offline for further 48H.', details:'Original maintenance window was 24H. Extended due to parts availability.' },
  ];

  for (const def of alertDefs) {
    const vessel = def.vid ? findV(def.vid) : null;
    alerts.push({
      alertId: `ALT-${String(idx++).padStart(4,'0')}`,
      type: def.type,
      severity: def.sev,
      terminalId: def.t ? def.t._id : null,
      terminalCode: def.tc,
      vesselId: vessel ? vessel._id : null,
      vesselCode: def.vid,
      berthId: null,
      message: def.msg,
      details: def.details,
      acknowledged: false,
      acknowledgedAt: null,
      expiresAt: addHours(NOW, 72),
      isDemoData: true,
    });
  }

  return alerts;
}

// ─── 10. OPERATIONS PLAN ─────────────────────────────────────────────────────

function makeOperationsPlan(terminalDocs) {
  const t2 = terminalDocs.find(t => t.terminalId === 'T2');
  const t3 = terminalDocs.find(t => t.terminalId === 'T3');

  return {
    planId: 'PLAN-0001',
    generatedAt: addHours(NOW, -1),
    generatedBy: 'AI_ENGINE',
    horizon: '72H',
    terminalIds: [t2._id, t3._id],
    terminalCodes: ['T2', 'T3'],
    overallRiskLevel: 'CRITICAL',
    summary: 'SYNTHETIC DEMO DATA — 72-Hour Operations Plan for Terminals T2 and T3. Immediate intervention required at T3 (CRITICAL). T2 requires proactive queue management. T1 is operating normally.',
    windows: [
      {
        label: '0-12H',
        title: 'Immediate Actions',
        riskLevel: 'CRITICAL',
        summary: 'T3 is at CRITICAL congestion. Priority: unblock crane resources and reassign highest-priority vessels.',
        actions: [
          { action:'Deploy available mobile crane from T1 to T3', reason:'T3 has 4 cranes in maintenance, 5 vessels waiting. T1 crane utilization is 45%.', affectedResource:'T1-C9 → T3', affectedResourceType:'CRANE', expectedBenefit:'Reduces T3 average waiting time by ~4H', priority:'CRITICAL', confidence:0.79 },
          { action:'Reroute V-309 (Enterprise, 18000 TEU) from T3 to T2-B2', reason:'T3 cannot service 18000 TEU vessel with available cranes. T2-B2 (18000 TEU capacity) becomes free in 8H.', affectedResource:'V-309', affectedResourceType:'VESSEL', expectedBenefit:'Reduces V-309 waiting from 22H to 9H; reduces T3 queue pressure', priority:'HIGH', confidence:0.75 },
          { action:'Pre-assign T2-B1 to V-207 (Alpha Prime) on berth clearance', reason:'V-207 (18000 TEU) has been waiting 3H. B1-T2 clears in 4H. Pre-assignment eliminates reassignment delay.', affectedResource:'V-207 → T2-B1', affectedResourceType:'BERTH', expectedBenefit:'Reduces V-207 waiting time by 3H', priority:'HIGH', confidence:0.83 },
          { action:'Issue delay advisory to V-308 (Resolution) — defer arrival by 6H', reason:'T3 berth queue is at capacity. Delaying V-308 by 6H aligns with berth availability window.', affectedResource:'V-308', affectedResourceType:'VESSEL', expectedBenefit:'Reduces T3 peak queue from 5 to 4 vessels', priority:'HIGH', confidence:0.77 },
        ],
      },
      {
        label: '12-24H',
        title: 'Congestion Management',
        riskLevel: 'HIGH',
        summary: 'T3 congestion begins to ease as berths clear. T2 peak arrival period requires active management.',
        actions: [
          { action:'Prioritize crane maintenance completion for C6-T3 and C7-T3', reason:'Restoring 2 cranes by hour 18 increases T3 processing capacity by 40%.', affectedResource:'C6-T3, C7-T3', affectedResourceType:'CRANE', expectedBenefit:'Adds ~60 TEU/hour processing capacity to T3', priority:'HIGH', confidence:0.70 },
          { action:'Implement 2-hour arrival windows for T2 inbound vessels V-214 through V-216', reason:'T2 has 8 vessels arriving in 4-hour window. Staggered arrivals reduce peak queue.', affectedResource:'V-214, V-215, V-216', affectedResourceType:'SCHEDULE', expectedBenefit:'Reduces T2 peak queue from 6 to 3 vessels', priority:'HIGH', confidence:0.78 },
          { action:'Resolve V-219 schedule conflict at T2', reason:'V-219 delayed 6H by berth conflict. Adjust slot to align with B3-T2 availability at H+14.', affectedResource:'V-219', affectedResourceType:'VESSEL', expectedBenefit:'Resolves conflict, enables planned crane assignment', priority:'HIGH', confidence:0.82 },
        ],
      },
      {
        label: '24-48H',
        title: 'Capacity Balancing',
        riskLevel: 'MEDIUM',
        summary: 'Congestion easing at T3 as berths clear and crane capacity improves. T2 stabilizing.',
        actions: [
          { action:'Return mobile crane to T1 after T3 backlog clears', reason:'T3 crane maintenance expected complete by H+36. Mobile crane no longer required at T3.', affectedResource:'T3-Mobile → T1', affectedResourceType:'CRANE', expectedBenefit:'Restores T1 operational flexibility', priority:'MEDIUM', confidence:0.72 },
          { action:'Review berth allocation for vessels arriving H+24 to H+48 at T2', reason:'Current allocation places 4 vessels >14000 TEU on medium-capacity berths. Rebalance to large berths.', affectedResource:'T2 berth schedule', affectedResourceType:'BERTH', expectedBenefit:'Improves processing efficiency by ~15%', priority:'MEDIUM', confidence:0.75 },
          { action:'Activate T3-B6 (currently in maintenance) for limited operations by H+36', reason:'Partial restoration of B6 enables additional vessel processing as queue clears.', affectedResource:'T3-B6', affectedResourceType:'BERTH', expectedBenefit:'Adds 1 berth slot, reduces queue by 1 vessel', priority:'MEDIUM', confidence:0.65 },
        ],
      },
      {
        label: '48-72H',
        title: 'Recovery & Normalization',
        riskLevel: 'LOW',
        summary: 'Port operations returning to normal. Monitoring required to prevent recurrence.',
        actions: [
          { action:'Complete crane maintenance at T3 (C8-T3, C9-T3)', reason:'Full crane complement expected restored by H+60. Verify and return to operational status.', affectedResource:'C8-T3, C9-T3', affectedResourceType:'CRANE', expectedBenefit:'Full T3 operational capacity restored', priority:'MEDIUM', confidence:0.68 },
          { action:'Monitor T2 berth utilization — trigger early alert if utilization exceeds 80%', reason:'T2 has recurring HIGH congestion pattern. Proactive monitoring prevents next peak.', affectedResource:'T2 all berths', affectedResourceType:'TERMINAL', expectedBenefit:'Early warning enables proactive intervention', priority:'LOW', confidence:0.85 },
          { action:'Review arrival scheduling for next 72H window', reason:'Current congestion was partly caused by uncoordinated large-vessel arrivals. Coordinate with shipping lines.', affectedResource:'All terminals', affectedResourceType:'GENERAL', expectedBenefit:'Prevents recurrence; reduces peak arrival rate by 20%', priority:'LOW', confidence:0.70 },
        ],
      },
    ],
    status: 'ACTIVE',
    isDemoData: true,
  };
}

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║    PortMind AI — Synthetic Demo Data Seed         ║');
  console.log('║    IBM Bob AI Hackathon 2026 — Team NeuraNex       ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  console.log('⚠  SYNTHETIC DEMO DATA — Not real port operational data\n');

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`✓ Connected to MongoDB: ${MONGODB_URI}\n`);

  // ── Step 1: Clear all collections ─────────────────────────────────────────
  console.log('Clearing existing data...');
  const models = [Terminal, Berth, Crane, Vessel, Schedule, HistoricalOperation,
                  CongestionPrediction, Recommendation, Alert, OperationsPlan];
  for (const Model of models) {
    await Model.deleteMany({ isDemoData: true });
  }
  console.log('✓ Cleared demo data from all collections\n');

  // ── Step 2: Terminals ─────────────────────────────────────────────────────
  console.log('Seeding terminals...');
  const terminalDocs = await Terminal.insertMany(TERMINAL_DEFS.map(t => ({ ...t, isDemoData: true })));
  console.log(`  ✓ ${terminalDocs.length} terminals inserted`);

  // ── Step 3: Berths ────────────────────────────────────────────────────────
  console.log('Seeding berths...');
  let allBerthData = [];
  for (const t of terminalDocs) {
    allBerthData.push(...makeBerths(t));
  }
  const berthDocs = await Berth.insertMany(allBerthData);
  console.log(`  ✓ ${berthDocs.length} berths inserted`);

  // ── Step 4: Cranes ────────────────────────────────────────────────────────
  console.log('Seeding cranes...');
  let allCraneData = [];
  for (const t of terminalDocs) {
    const termBerths = berthDocs.filter(b => b.terminalCode === t.terminalId);
    allCraneData.push(...makeCranes(t, termBerths));
  }
  const craneDocs = await Crane.insertMany(allCraneData);
  console.log(`  ✓ ${craneDocs.length} cranes inserted`);

  // ── Step 5: Vessels ───────────────────────────────────────────────────────
  console.log('Seeding vessels...');
  const vesselData = makeVessels(terminalDocs, berthDocs);
  const vesselDocs = await Vessel.insertMany(vesselData);
  console.log(`  ✓ ${vesselDocs.length} vessels inserted`);

  // ── Step 6: Update berths with vessel assignments ─────────────────────────
  const atBerthVessels = vesselDocs.filter(v => v.status === 'AT_BERTH' && v.assignedBerthId);
  for (const v of atBerthVessels) {
    await Berth.findByIdAndUpdate(v.assignedBerthId, { assignedVesselId: v._id });
  }
  console.log(`  ✓ ${atBerthVessels.length} berths updated with vessel assignments`);

  // ── Step 7: Assign cranes to at-berth vessels ─────────────────────────────
  for (const v of atBerthVessels) {
    const availCranes = craneDocs.filter(
      c => c.terminalCode === v.terminalCode && c.status === 'ACTIVE' && !c.assignedVesselId
    ).slice(0, v.requiredCranes);
    if (availCranes.length > 0) {
      const craneIds = availCranes.map(c => c._id);
      await Vessel.findByIdAndUpdate(v._id, { assignedCraneIds: craneIds });
      for (const c of availCranes) {
        await Crane.findByIdAndUpdate(c._id, { assignedVesselId: v._id });
      }
    }
  }
  console.log(`  ✓ Crane assignments applied to at-berth vessels`);

  // ── Step 8: Schedules ─────────────────────────────────────────────────────
  console.log('Seeding schedules...');
  const scheduleData = makeSchedules(vesselDocs, terminalDocs, berthDocs);
  const scheduleDocs = await Schedule.insertMany(scheduleData);
  console.log(`  ✓ ${scheduleDocs.length} schedules inserted`);

  // ── Step 9: Historical operations (90 days × 3 terminals) ────────────────
  console.log('Seeding historical operations (90 days × 3 terminals)...');
  const historicalData = makeHistoricalOperations(terminalDocs);
  await HistoricalOperation.insertMany(historicalData);
  console.log(`  ✓ ${historicalData.length} historical operation records inserted`);

  // ── Step 10: Congestion predictions ───────────────────────────────────────
  console.log('Seeding congestion predictions...');
  const predData = makeCongestionPredictions(terminalDocs, berthDocs);
  const predDocs = await CongestionPrediction.insertMany(predData);
  console.log(`  ✓ ${predDocs.length} congestion predictions inserted`);

  // ── Step 11: Recommendations ──────────────────────────────────────────────
  console.log('Seeding recommendations...');
  const recData = makeRecommendations(terminalDocs, vesselDocs, berthDocs);
  const recDocs = await Recommendation.insertMany(recData);
  console.log(`  ✓ ${recDocs.length} recommendations inserted`);

  // ── Step 12: Alerts ───────────────────────────────────────────────────────
  console.log('Seeding alerts...');
  const alertData = makeAlerts(terminalDocs, vesselDocs, berthDocs);
  const alertDocs = await Alert.insertMany(alertData);
  console.log(`  ✓ ${alertDocs.length} alerts inserted`);

  // ── Step 13: Operations plan ──────────────────────────────────────────────
  console.log('Seeding operations plan...');
  const planData = makeOperationsPlan(terminalDocs);
  await OperationsPlan.insertMany([planData]);
  console.log(`  ✓ 1 operations plan inserted`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  Seed Complete — Summary                           ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Terminals           : ${String(terminalDocs.length).padStart(4)}                          ║`);
  console.log(`║  Berths              : ${String(berthDocs.length).padStart(4)}                          ║`);
  console.log(`║  Cranes              : ${String(craneDocs.length).padStart(4)}                          ║`);
  console.log(`║  Vessels             : ${String(vesselDocs.length).padStart(4)}                          ║`);
  console.log(`║  Schedules           : ${String(scheduleDocs.length).padStart(4)}                          ║`);
  console.log(`║  Historical Records  : ${String(historicalData.length).padStart(4)}                          ║`);
  console.log(`║  Congestion Preds    : ${String(predDocs.length).padStart(4)}                          ║`);
  console.log(`║  Recommendations     : ${String(recDocs.length).padStart(4)}                          ║`);
  console.log(`║  Alerts              : ${String(alertDocs.length).padStart(4)}                          ║`);
  console.log(`║  Operations Plans    :    1                          ║`);
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('Demo scenarios seeded:');
  console.log('  S1 — T1: LOW congestion, normal operations');
  console.log('  S2 — T2: MEDIUM/HIGH congestion, berth competition (V-206/V-207/V-208 waiting)');
  console.log('  S3 — T3: CRITICAL congestion, high utilization (V-306 to V-310 in queue)');
  console.log('  S4 — T3: V-309 crane shortfall (requires 4 cranes, insufficient available)');
  console.log('  S5 — T2: V-206/V-207/V-208 competing for 1 available berth');
  console.log('  S6 — T2: V-219 delayed (schedule conflict with V-201)\n');

  await mongoose.disconnect();
  console.log('✓ MongoDB disconnected\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
