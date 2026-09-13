'use strict';

/**
 * PortMind AI — Terminals API Tests
 *
 * Strategy:
 *  - Jest module mocks for terminalService (avoids any DB connection)
 *  - Validates correct response shapes and 404 handling
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock terminalService ─────────────────────────────────────────────────────

const mockTerminal = {
  _id: '64a1b2c3d4e5f6789012aaaa',
  terminalId: 'T1',
  name: 'Tuas Terminal 1',
  shortName: 'TT1',
  totalBerths: 8,
  activeBerths: 8,
  maxTEUCapacity: 60000,
  currentTEULoad: 38000,
  totalCranes: 12,
  activeCranes: 10,
  operationalStatus: 'ACTIVE',
  maxVesselsSimultaneous: 6,
};

const mockTerminalWithDetail = {
  ...mockTerminal,
  berths: [],
  cranes: [],
  activeVessels: 4,
};

jest.mock('../src/services/terminalService', () => ({
  listTerminals: jest.fn(async () => [mockTerminal]),
  getTerminalById: jest.fn(async (id) => {
    if (id === 'T1' || id === '64a1b2c3d4e5f6789012aaaa') return mockTerminalWithDetail;
    return null;
  }),
  getTerminalSummary: jest.fn(async (id) => {
    if (id === 'T1' || id === '64a1b2c3d4e5f6789012aaaa') {
      return {
        terminal: mockTerminal,
        berthSummary: { AVAILABLE: { count: 3, avgUtil: 0 }, OCCUPIED: { count: 5, avgUtil: 80 } },
        craneSummary: { ACTIVE: 8, IDLE: 2, MAINTENANCE: 2 },
        vesselSummary: { AT_BERTH: 4, INBOUND: 2 },
        utilizationPercent: 63,
      };
    }
    return null;
  }),
}));

// ─── GET /api/terminals ───────────────────────────────────────────────────────

describe('GET /api/terminals', () => {
  it('returns list with success=true', async () => {
    const res = await request(app).get('/api/terminals');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns at least one terminal in the list', async () => {
    const res = await request(app).get('/api/terminals');
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('each terminal has required fields', async () => {
    const res = await request(app).get('/api/terminals');
    const t = res.body.data[0];
    expect(t).toHaveProperty('terminalId');
    expect(t).toHaveProperty('name');
    expect(t).toHaveProperty('totalBerths');
    expect(t).toHaveProperty('operationalStatus');
  });
});

// ─── GET /api/terminals/:id ───────────────────────────────────────────────────

describe('GET /api/terminals/:id', () => {
  it('returns terminal by terminalId string', async () => {
    const res = await request(app).get('/api/terminals/T1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.terminalId).toBe('T1');
  });

  it('returns terminal by MongoDB ObjectId', async () => {
    const res = await request(app).get('/api/terminals/64a1b2c3d4e5f6789012aaaa');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown terminal ID', async () => {
    const res = await request(app).get('/api/terminals/T99');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returned terminal has berths and cranes arrays', async () => {
    const res = await request(app).get('/api/terminals/T1');
    expect(res.body.data).toHaveProperty('berths');
    expect(res.body.data).toHaveProperty('cranes');
    expect(Array.isArray(res.body.data.berths)).toBe(true);
    expect(Array.isArray(res.body.data.cranes)).toBe(true);
  });
});

// ─── GET /api/terminals/:id/summary ──────────────────────────────────────────

describe('GET /api/terminals/:id/summary', () => {
  it('returns summary with expected shape', async () => {
    const res = await request(app).get('/api/terminals/T1/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('terminal');
    expect(res.body.data).toHaveProperty('berthSummary');
    expect(res.body.data).toHaveProperty('craneSummary');
    expect(res.body.data).toHaveProperty('utilizationPercent');
  });

  it('returns 404 for unknown terminal in summary', async () => {
    const res = await request(app).get('/api/terminals/NOTFOUND/summary');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
