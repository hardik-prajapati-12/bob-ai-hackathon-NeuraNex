'use strict';

/**
 * PortMind AI — Dashboard API Tests
 *
 * Strategy:
 *  - Jest module mocks for congestionService, vesselService, Alert model, Berth model
 *  - Validates GET /api/dashboard/summary and GET /api/dashboard/charts shapes
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../src/services/congestionService', () => ({
  getCurrentCongestion: jest.fn(async () => ({
    overallLevel: 'MEDIUM',
    overallScore: 0.48,
    terminals: [
      {
        terminalCode: 'T1',
        terminalName: 'Tuas Terminal 1',
        congestionLevel: 'MEDIUM',
        congestionScore: 0.48,
        snapshot: {
          berths: { occupied: 5, total: 8 },
          vessels: { queuedVessels: 2 },
        },
      },
    ],
  })),
  getCongestionHistory: jest.fn(async () => ({
    series: [
      { date: '2025-01-01', score: 0.42, level: 'MEDIUM' },
      { date: '2025-01-02', score: 0.55, level: 'MEDIUM' },
    ],
  })),
}));

jest.mock('../src/services/vesselService', () => ({
  listVessels: jest.fn(async () => ({ vessels: [], pagination: {} })),
  getVesselById: jest.fn(async () => null),
  getAtRiskVessels: jest.fn(async () => []),
  getVesselStats: jest.fn(async () => ({
    total: 20,
    atRisk: 4,
    waiting: 3,
    atBerth: 7,
    inbound: 6,
    byStatus: { AT_BERTH: 7, WAITING: 3, INBOUND: 6 },
    byRisk: { HIGH: 3, CRITICAL: 1, MEDIUM: 8, LOW: 8 },
  })),
}));

jest.mock('../src/models/Alert', () => ({
  countDocuments: jest.fn(async () => 3),
}));

jest.mock('../src/models/Berth', () => ({
  find: jest.fn(() => ({
    lean: jest.fn(async () => [
      { currentStatus: 'OCCUPIED' },
      { currentStatus: 'OCCUPIED' },
      { currentStatus: 'AVAILABLE' },
      { currentStatus: 'AVAILABLE' },
      { currentStatus: 'MAINTENANCE' },
    ]),
  })),
}));

// ─── GET /api/dashboard/summary ───────────────────────────────────────────────

describe('GET /api/dashboard/summary', () => {
  it('returns 200 with success=true', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns expected top-level fields', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    const d = res.body.data;
    expect(d).toHaveProperty('totalVessels');
    expect(d).toHaveProperty('atRiskVessels');
    expect(d).toHaveProperty('berthUtilization');
    expect(d).toHaveProperty('activeAlerts');
    expect(d).toHaveProperty('congestionLevel');
    expect(d).toHaveProperty('congestionScore');
  });

  it('returns terminals array', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(Array.isArray(res.body.data.terminals)).toBe(true);
    expect(res.body.data.terminals.length).toBeGreaterThanOrEqual(1);
  });

  it('each terminal entry has expected fields', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    const t = res.body.data.terminals[0];
    expect(t).toHaveProperty('terminalCode');
    expect(t).toHaveProperty('congestionLevel');
    expect(t).toHaveProperty('congestionScore');
    expect(t).toHaveProperty('berthsOccupied');
    expect(t).toHaveProperty('berthsTotal');
  });

  it('berthUtilization is a number between 0 and 100', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    const util = res.body.data.berthUtilization;
    expect(typeof util).toBe('number');
    expect(util).toBeGreaterThanOrEqual(0);
    expect(util).toBeLessThanOrEqual(100);
  });

  it('activeAlerts is a non-negative number', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(typeof res.body.data.activeAlerts).toBe('number');
    expect(res.body.data.activeAlerts).toBeGreaterThanOrEqual(0);
  });

  it('vesselsByStatus and vesselsByRisk are objects', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(typeof res.body.data.vesselsByStatus).toBe('object');
    expect(typeof res.body.data.vesselsByRisk).toBe('object');
  });
});

// ─── GET /api/dashboard/charts ────────────────────────────────────────────────

describe('GET /api/dashboard/charts', () => {
  it('returns 200 with success=true', async () => {
    const res = await request(app).get('/api/dashboard/charts');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns expected chart data fields', async () => {
    const res = await request(app).get('/api/dashboard/charts');
    const d = res.body.data;
    expect(d).toHaveProperty('congestionTrend');
    expect(d).toHaveProperty('vesselArrivals');
    expect(d).toHaveProperty('berthUtilization');
  });

  it('congestionTrend is an array', async () => {
    const res = await request(app).get('/api/dashboard/charts');
    expect(Array.isArray(res.body.data.congestionTrend)).toBe(true);
  });

  it('congestionTrend entries have date and score fields', async () => {
    const res = await request(app).get('/api/dashboard/charts');
    const trend = res.body.data.congestionTrend;
    if (trend.length > 0) {
      expect(trend[0]).toHaveProperty('date');
      expect(trend[0]).toHaveProperty('score');
    }
  });
});
