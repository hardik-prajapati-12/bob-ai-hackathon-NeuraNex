'use strict';

/**
 * PortMind AI — Vessels API Tests
 *
 * Strategy:
 *  - Jest module mocks for vesselService (avoids any DB connection)
 *  - Validation-layer tests using supertest (400 responses need no DB)
 *  - Service-layer mock tests verify correct response shapes
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock vesselService to avoid DB calls ────────────────────────────────────

const mockVessel = {
  _id: '64a1b2c3d4e5f6789012abcd',
  vesselId: 'V-101',
  vesselName: 'Ever Fortune',
  vesselType: 'CONTAINER',
  sizeTEU: 14000,
  status: 'AT_BERTH',
  congestionRisk: 'HIGH',
  congestionRiskScore: 0.72,
  terminalCode: 'T1',
  waitingHours: 4,
  arrivalTime: new Date().toISOString(),
};

const mockStats = {
  total: 25,
  atRisk: 6,
  waiting: 4,
  atBerth: 8,
  inbound: 7,
  byStatus: { AT_BERTH: 8, WAITING: 4, INBOUND: 7, DEPARTED: 6 },
  byRisk: { HIGH: 4, CRITICAL: 2, MEDIUM: 10, LOW: 9 },
};

jest.mock('../src/services/vesselService', () => ({
  listVessels: jest.fn(async (q) => ({
    vessels: [mockVessel],
    pagination: { page: 1, limit: 50, total: 1, pages: 1 },
  })),
  getVesselById: jest.fn(async (id) => {
    if (id === 'V-101' || id === '64a1b2c3d4e5f6789012abcd') return mockVessel;
    return null;
  }),
  getAtRiskVessels: jest.fn(async () => [mockVessel]),
  getVesselStats: jest.fn(async () => mockStats),
}));

// ─── GET /api/vessels ─────────────────────────────────────────────────────────

describe('GET /api/vessels', () => {
  it('returns paginated list with success=true', async () => {
    const res = await request(app).get('/api/vessels');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('returns 400 when page param is invalid', async () => {
    const res = await request(app).get('/api/vessels').query({ page: '0' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when limit is out of range', async () => {
    const res = await request(app).get('/api/vessels').query({ limit: '200' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid sortBy value', async () => {
    const res = await request(app).get('/api/vessels').query({ sortBy: 'invalidField' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid sortOrder value', async () => {
    const res = await request(app).get('/api/vessels').query({ sortOrder: 'random' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts valid status filter without error', async () => {
    const res = await request(app).get('/api/vessels').query({ status: 'AT_BERTH' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts valid congestionRisk filter', async () => {
    const res = await request(app).get('/api/vessels').query({ congestionRisk: 'HIGH' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts valid terminalCode filter', async () => {
    const res = await request(app).get('/api/vessels').query({ terminalCode: 'T1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts search query filter', async () => {
    const res = await request(app).get('/api/vessels').query({ search: 'Fortune' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts valid sortBy and sortOrder', async () => {
    const res = await request(app)
      .get('/api/vessels')
      .query({ sortBy: 'vesselName', sortOrder: 'desc' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/vessels/stats ───────────────────────────────────────────────────

describe('GET /api/vessels/stats', () => {
  it('returns stats with expected shape', async () => {
    const res = await request(app).get('/api/vessels/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('atRisk');
    expect(res.body.data).toHaveProperty('byStatus');
    expect(res.body.data).toHaveProperty('byRisk');
  });

  it('returns numeric total', async () => {
    const res = await request(app).get('/api/vessels/stats');
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.atRisk).toBe('number');
  });
});

// ─── GET /api/vessels/at-risk ─────────────────────────────────────────────────

describe('GET /api/vessels/at-risk', () => {
  it('returns array of at-risk vessels', async () => {
    const res = await request(app).get('/api/vessels/at-risk');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returned vessels have congestionRisk HIGH or CRITICAL', async () => {
    const res = await request(app).get('/api/vessels/at-risk');
    res.body.data.forEach((v) => {
      expect(['HIGH', 'CRITICAL']).toContain(v.congestionRisk);
    });
  });
});

// ─── GET /api/vessels/:id ─────────────────────────────────────────────────────

describe('GET /api/vessels/:id', () => {
  it('returns vessel by vesselId string', async () => {
    const res = await request(app).get('/api/vessels/V-101');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vesselId).toBe('V-101');
  });

  it('returns vessel by MongoDB ObjectId', async () => {
    const res = await request(app).get('/api/vessels/64a1b2c3d4e5f6789012abcd');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown vesselId', async () => {
    const res = await request(app).get('/api/vessels/V-UNKNOWN');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Response shape assertions ────────────────────────────────────────────────

describe('Vessel response shape', () => {
  it('list response has expected fields on each vessel', async () => {
    const res = await request(app).get('/api/vessels');
    expect(res.statusCode).toBe(200);
    const vessel = res.body.data[0];
    expect(vessel).toHaveProperty('vesselId');
    expect(vessel).toHaveProperty('vesselName');
    expect(vessel).toHaveProperty('status');
    expect(vessel).toHaveProperty('congestionRisk');
  });

  it('pagination object has correct fields', async () => {
    const res = await request(app).get('/api/vessels');
    const p = res.body.pagination;
    expect(p).toHaveProperty('page');
    expect(p).toHaveProperty('limit');
    expect(p).toHaveProperty('total');
    expect(p).toHaveProperty('pages');
  });
});
