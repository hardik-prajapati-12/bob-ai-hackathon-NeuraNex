'use strict';

/**
 * PortMind AI — Alerts API Tests
 *
 * Strategy:
 *  - Jest module mocks for Alert model (avoids any DB connection)
 *  - Tests GET list with filters, GET by ID, PUT acknowledge
 *  - Tests 404 handling and invalid ObjectId → 400 via errorHandler
 */

const request = require('supertest');
const { app } = require('../src/server');

// ─── Mock Alert model ─────────────────────────────────────────────────────────
// Note: jest.mock() is hoisted; all helpers must be defined INSIDE the factory
// or named with a `mock`-prefix (Jest hoisting allowance).

jest.mock('../src/models/Alert', () => {
  const alertDoc = {
    _id: '64a1b2c3d4e5f6789012ee01',
    alertId: 'ALT-001',
    type: 'CONGESTION_RISK',
    severity: 'HIGH',
    terminalCode: 'T1',
    message: 'Terminal T1 congestion is HIGH',
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };

  // Mongoose document instance with save + toObject (for PUT acknowledge)
  const alertInstance = {
    ...alertDoc,
    acknowledged: false,
    save: jest.fn(async () => {}),
    toObject: jest.fn(() => ({
      ...alertDoc,
      acknowledged: true,
      acknowledgedBy: 'Operator',
      acknowledgedAt: new Date(),
    })),
  };

  // Chainable mock for Alert.find() — used by GET /api/alerts
  function buildFindChain(result) {
    return {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    };
  }

  // findById must return an object with .lean() for GET /:id
  // and also be awaitable for PUT /:id/acknowledge (which does: await findById(id))
  // We use a custom thenable to support both usage patterns.
  function makeGetByIdResult(doc) {
    // Returns an object that:
    //  - has .lean() for GET route: await Alert.findById(id).lean()
    //  - is a thenable so that: const x = await Alert.findById(id) also works
    const result = {
      lean: jest.fn().mockResolvedValue(doc),
      then: (resolve) => resolve(doc),
      catch: (reject) => reject,
    };
    return result;
  }

  return {
    find: jest.fn(() => buildFindChain([alertDoc])),

    findById: jest.fn((id) => {
      // Simulate CastError for invalid ObjectId strings
      if (id === 'invalid-id-string') {
        // Return thenable that rejects (simulates mongoose throwing CastError)
        const err = new Error('Cast to ObjectId failed');
        err.name = 'CastError';
        return {
          lean: jest.fn().mockRejectedValue(err),
          then: (resolve, reject) => (reject ? reject(err) : undefined),
          catch: (fn) => fn(err),
        };
      }
      // ID used by GET /:id tests
      if (id === '64a1b2c3d4e5f6789012ee01') {
        return makeGetByIdResult(alertDoc);
      }
      // ID used by PUT /:id/acknowledge tests (awaited directly in route)
      if (id === '64a1b2c3d4e5f6789012ee02') {
        return {
          lean: jest.fn().mockResolvedValue(alertInstance),
          then: (resolve) => resolve(alertInstance),
          catch: () => {},
        };
      }
      // Any other valid-looking ID → null (not found)
      return {
        lean: jest.fn().mockResolvedValue(null),
        then: (resolve) => resolve(null),
        catch: () => {},
      };
    }),

    countDocuments: jest.fn(async () => 1),
  };
});

// ─── GET /api/alerts ──────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
  it('returns paginated list with success=true', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('pagination object has correct fields', async () => {
    const res = await request(app).get('/api/alerts');
    const p = res.body.pagination;
    expect(p).toHaveProperty('page');
    expect(p).toHaveProperty('limit');
    expect(p).toHaveProperty('total');
    expect(p).toHaveProperty('pages');
  });

  it('filters by severity query param', async () => {
    const res = await request(app).get('/api/alerts').query({ severity: 'HIGH' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by type query param', async () => {
    const res = await request(app).get('/api/alerts').query({ type: 'CONGESTION_RISK' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by acknowledged=false', async () => {
    const res = await request(app).get('/api/alerts').query({ acknowledged: 'false' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by acknowledged=true', async () => {
    const res = await request(app).get('/api/alerts').query({ acknowledged: 'true' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('filters by terminalCode query param', async () => {
    const res = await request(app).get('/api/alerts').query({ terminalCode: 'T1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('respects custom page and limit params', async () => {
    const res = await request(app).get('/api/alerts').query({ page: '2', limit: '10' });
    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('clamps limit to 100 max', async () => {
    const res = await request(app).get('/api/alerts').query({ limit: '500' });
    expect(res.statusCode).toBe(200);
    expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
  });
});

// ─── GET /api/alerts/:id ──────────────────────────────────────────────────────

describe('GET /api/alerts/:id', () => {
  it('returns alert for valid MongoDB ObjectId that exists', async () => {
    const res = await request(app).get('/api/alerts/64a1b2c3d4e5f6789012ee01');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for valid ObjectId that does not exist in mock', async () => {
    const res = await request(app).get('/api/alerts/64a1b2c3d4e5f6789012ffff');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid ObjectId format (CastError → errorHandler)', async () => {
    const res = await request(app).get('/api/alerts/invalid-id-string');
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── PUT /api/alerts/:id/acknowledge ─────────────────────────────────────────

describe('PUT /api/alerts/:id/acknowledge', () => {
  it('acknowledges an existing alert', async () => {
    const res = await request(app).put('/api/alerts/64a1b2c3d4e5f6789012ee02/acknowledge');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when alert does not exist', async () => {
    const res = await request(app).put('/api/alerts/64a1b2c3d4e5f6789012ffff/acknowledge');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid ObjectId on acknowledge (CastError)', async () => {
    const res = await request(app).put('/api/alerts/invalid-id-string/acknowledge');
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
