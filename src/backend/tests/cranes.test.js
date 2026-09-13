'use strict';

/**
 * PortMind AI — Cranes API Tests
 *
 * Strategy:
 *  - Jest module mocks for craneService (avoids any DB connection)
 *  - Validates list, filter, and detail endpoints
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock craneService ────────────────────────────────────────────────────────

const mockCrane = {
  _id: '64a1b2c3d4e5f6789012cc01',
  craneId: 'C1-T1',
  terminalCode: 'T1',
  name: 'STS Crane 1',
  type: 'SHIP_TO_SHORE',
  status: 'ACTIVE',
  liftCapacityTEUPerHour: 35,
  maxLiftWeightTonnes: 65,
  utilizationPercent: 88,
};

const mockCraneIdle = {
  ...mockCrane,
  _id: '64a1b2c3d4e5f6789012cc02',
  craneId: 'C2-T1',
  name: 'STS Crane 2',
  status: 'IDLE',
  utilizationPercent: 0,
};

const mockCraneMaint = {
  ...mockCrane,
  _id: '64a1b2c3d4e5f6789012cc03',
  craneId: 'C1-T2',
  terminalCode: 'T2',
  name: 'RTG Crane 1',
  type: 'RUBBER_TIRED_GANTRY',
  status: 'MAINTENANCE',
};

jest.mock('../src/services/craneService', () => ({
  listCranes: jest.fn(async (q) => {
    if (q && q.status === 'MAINTENANCE') return [mockCraneMaint];
    if (q && q.status === 'ACTIVE') return [mockCrane];
    if (q && q.status === 'IDLE') return [mockCraneIdle];
    return [mockCrane, mockCraneIdle, mockCraneMaint];
  }),
  getCraneById: jest.fn(async (id) => {
    if (id === 'C1-T1' || id === '64a1b2c3d4e5f6789012cc01') return mockCrane;
    return null;
  }),
}));

// ─── GET /api/cranes ──────────────────────────────────────────────────────────

describe('GET /api/cranes', () => {
  it('returns list with success=true', async () => {
    const res = await request(app).get('/api/cranes');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns multiple cranes in list', async () => {
    const res = await request(app).get('/api/cranes');
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('each crane has required fields', async () => {
    const res = await request(app).get('/api/cranes');
    const c = res.body.data[0];
    expect(c).toHaveProperty('craneId');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('type');
    expect(c).toHaveProperty('terminalCode');
  });

  it('filters by status=ACTIVE', async () => {
    const res = await request(app).get('/api/cranes').query({ status: 'ACTIVE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((c) => c.status === 'ACTIVE')).toBe(true);
  });

  it('filters by status=IDLE', async () => {
    const res = await request(app).get('/api/cranes').query({ status: 'IDLE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by status=MAINTENANCE', async () => {
    const res = await request(app).get('/api/cranes').query({ status: 'MAINTENANCE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((c) => c.status === 'MAINTENANCE')).toBe(true);
  });

  it('filters by terminalCode', async () => {
    const res = await request(app).get('/api/cranes').query({ terminalCode: 'T1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by crane type', async () => {
    const res = await request(app).get('/api/cranes').query({ type: 'SHIP_TO_SHORE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/cranes/:id ──────────────────────────────────────────────────────

describe('GET /api/cranes/:id', () => {
  it('returns crane by craneId string', async () => {
    const res = await request(app).get('/api/cranes/C1-T1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.craneId).toBe('C1-T1');
  });

  it('returns crane by MongoDB ObjectId', async () => {
    const res = await request(app).get('/api/cranes/64a1b2c3d4e5f6789012cc01');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown craneId', async () => {
    const res = await request(app).get('/api/cranes/C99-T99');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returned crane has expected fields', async () => {
    const res = await request(app).get('/api/cranes/C1-T1');
    const c = res.body.data;
    expect(c).toHaveProperty('craneId');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('type');
    expect(c).toHaveProperty('liftCapacityTEUPerHour');
  });
});
