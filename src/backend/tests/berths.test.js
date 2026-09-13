'use strict';

/**
 * PortMind AI — Berths API Tests
 *
 * Strategy:
 *  - Jest module mocks for berthService (avoids any DB connection)
 *  - Validates list, filter, detail, and available endpoints
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock berthService ────────────────────────────────────────────────────────

const mockBerth = {
  _id: '64a1b2c3d4e5f6789012bb01',
  berthId: 'B1-T1',
  terminalCode: 'T1',
  name: 'Berth 1 — Tuas T1',
  maxVesselSizeTEU: 18000,
  maxVesselLengthM: 400,
  maxDraftM: 16,
  currentStatus: 'OCCUPIED',
  berthNumber: 1,
  craneCount: 3,
  processingRateTEUPerHour: 350,
  utilizationPercent: 82,
};

const mockBerthT2 = {
  ...mockBerth,
  _id: '64a1b2c3d4e5f6789012bb02',
  berthId: 'B1-T2',
  terminalCode: 'T2',
  name: 'Berth 1 — Tuas T2',
  currentStatus: 'AVAILABLE',
};

jest.mock('../src/services/berthService', () => ({
  listBerths: jest.fn(async (q) => {
    if (q && q.terminalCode === 'T2') return [mockBerthT2];
    return [mockBerth, mockBerthT2];
  }),
  getBerthById: jest.fn(async (id) => {
    if (id === 'B1-T1' || id === '64a1b2c3d4e5f6789012bb01') return mockBerth;
    return null;
  }),
  getAvailableBerths: jest.fn(async () => [mockBerthT2]),
}));

// ─── GET /api/berths ──────────────────────────────────────────────────────────

describe('GET /api/berths', () => {
  it('returns list with success=true', async () => {
    const res = await request(app).get('/api/berths');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns berths when terminalCode filter is applied', async () => {
    const res = await request(app).get('/api/berths').query({ terminalCode: 'T2' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].terminalCode).toBe('T2');
  });

  it('each berth has required fields', async () => {
    const res = await request(app).get('/api/berths');
    const b = res.body.data[0];
    expect(b).toHaveProperty('berthId');
    expect(b).toHaveProperty('terminalCode');
    expect(b).toHaveProperty('currentStatus');
    expect(b).toHaveProperty('maxVesselSizeTEU');
  });

  it('accepts status filter without error', async () => {
    const res = await request(app).get('/api/berths').query({ status: 'AVAILABLE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/berths/available ────────────────────────────────────────────────

describe('GET /api/berths/available', () => {
  it('returns list of available berths', async () => {
    const res = await request(app).get('/api/berths/available');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts terminalCode and minTEU filters', async () => {
    const res = await request(app)
      .get('/api/berths/available')
      .query({ terminalCode: 'T1', minTEU: '8000' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/berths/:id ──────────────────────────────────────────────────────

describe('GET /api/berths/:id', () => {
  it('returns berth by berthId string', async () => {
    const res = await request(app).get('/api/berths/B1-T1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.berthId).toBe('B1-T1');
  });

  it('returns berth by MongoDB ObjectId', async () => {
    const res = await request(app).get('/api/berths/64a1b2c3d4e5f6789012bb01');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown berthId', async () => {
    const res = await request(app).get('/api/berths/B99-T99');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returned berth has required fields', async () => {
    const res = await request(app).get('/api/berths/B1-T1');
    const b = res.body.data;
    expect(b).toHaveProperty('berthId');
    expect(b).toHaveProperty('currentStatus');
    expect(b).toHaveProperty('maxVesselSizeTEU');
    expect(b).toHaveProperty('terminalCode');
  });
});
