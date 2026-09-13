'use strict';

/**
 * PortMind AI — Schedules API Tests
 *
 * Strategy:
 *  - Jest module mocks for scheduleService (avoids any DB connection)
 *  - Validates list with filters/pagination, date validation, and detail endpoint
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock scheduleService ─────────────────────────────────────────────────────

const mockSchedule = {
  _id: '64a1b2c3d4e5f6789012dd01',
  scheduleId: 'SCH-001',
  vesselCode: 'V-101',
  vesselName: 'Ever Fortune',
  terminalCode: 'T1',
  berthCode: 'B1-T1',
  plannedArrival: new Date('2025-06-01T08:00:00Z').toISOString(),
  plannedDeparture: new Date('2025-06-02T08:00:00Z').toISOString(),
  processingHoursEstimate: 24,
  teuToProcess: 8000,
  requiredCranes: 3,
  status: 'SCHEDULED',
  priority: 'MEDIUM',
  delayHours: 0,
};

jest.mock('../src/services/scheduleService', () => ({
  listSchedules: jest.fn(async (q) => ({
    schedules: [mockSchedule],
    pagination: { page: 1, limit: 50, total: 1, pages: 1 },
  })),
  getScheduleById: jest.fn(async (id) => {
    if (id === 'SCH-001' || id === '64a1b2c3d4e5f6789012dd01') return mockSchedule;
    return null;
  }),
  getSchedulesByVessel: jest.fn(async () => [mockSchedule]),
}));

// ─── GET /api/schedules ───────────────────────────────────────────────────────

describe('GET /api/schedules', () => {
  it('returns paginated list with success=true', async () => {
    const res = await request(app).get('/api/schedules');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('returns 400 for invalid page param', async () => {
    const res = await request(app).get('/api/schedules').query({ page: '0' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for limit out of range', async () => {
    const res = await request(app).get('/api/schedules').query({ limit: '200' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid from date', async () => {
    const res = await request(app).get('/api/schedules').query({ from: 'not-a-date' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid to date', async () => {
    const res = await request(app).get('/api/schedules').query({ to: 'not-a-date' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts valid ISO8601 from/to date range', async () => {
    const res = await request(app)
      .get('/api/schedules')
      .query({ from: '2025-06-01T00:00:00Z', to: '2025-06-30T23:59:59Z' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts terminalCode filter', async () => {
    const res = await request(app).get('/api/schedules').query({ terminalCode: 'T1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('accepts status filter', async () => {
    const res = await request(app).get('/api/schedules').query({ status: 'ACTIVE' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('pagination object has required fields', async () => {
    const res = await request(app).get('/api/schedules');
    const p = res.body.pagination;
    expect(p).toHaveProperty('page');
    expect(p).toHaveProperty('limit');
    expect(p).toHaveProperty('total');
    expect(p).toHaveProperty('pages');
  });

  it('each schedule has required fields', async () => {
    const res = await request(app).get('/api/schedules');
    const s = res.body.data[0];
    expect(s).toHaveProperty('scheduleId');
    expect(s).toHaveProperty('vesselCode');
    expect(s).toHaveProperty('terminalCode');
    expect(s).toHaveProperty('status');
    expect(s).toHaveProperty('plannedArrival');
  });
});

// ─── GET /api/schedules/:id ───────────────────────────────────────────────────

describe('GET /api/schedules/:id', () => {
  it('returns schedule by scheduleId string', async () => {
    const res = await request(app).get('/api/schedules/SCH-001');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scheduleId).toBe('SCH-001');
  });

  it('returns schedule by MongoDB ObjectId', async () => {
    const res = await request(app).get('/api/schedules/64a1b2c3d4e5f6789012dd01');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown scheduleId', async () => {
    const res = await request(app).get('/api/schedules/SCH-UNKNOWN');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/schedules/vessel/:vesselId ─────────────────────────────────────

describe('GET /api/schedules/vessel/:vesselId', () => {
  it('returns schedules for a vessel', async () => {
    const res = await request(app).get('/api/schedules/vessel/V-101');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
