'use strict';

/**
 * PortMind AI — Optimization API Integration Tests
 *
 * Validation-layer tests only (no live MongoDB required).
 * Tests verify that the Express middleware correctly rejects malformed
 * requests before any database query is attempted.
 *
 * DB-dependent endpoint tests (success/200 responses with live data) are
 * verified manually against the running application with seeded MongoDB.
 */

const request = require('supertest');
const { app } = require('../src/server');

// ── GET /api/optimization/berths — query validation ───────────────────────────

describe('GET /api/optimization/berths — validation', () => {
  it('rejects empty terminalCode (whitespace-only)', async () => {
    const res = await request(app)
      .get('/api/optimization/berths')
      .query({ terminalCode: '   ' });
    // trim + notEmpty should fail
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/optimization/cranes — query validation ───────────────────────────

describe('GET /api/optimization/cranes — validation', () => {
  it('rejects empty terminalCode string', async () => {
    const res = await request(app)
      .get('/api/optimization/cranes')
      .query({ terminalCode: '' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/optimization/conflicts — query validation ────────────────────────

describe('GET /api/optimization/conflicts — validation', () => {
  it('rejects empty terminalCode string', async () => {
    const res = await request(app)
      .get('/api/optimization/conflicts')
      .query({ terminalCode: '' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── POST /api/optimization/optimize — body validation ────────────────────────

describe('POST /api/optimization/optimize — validation', () => {
  it('rejects empty terminalCode string in body', async () => {
    const res = await request(app)
      .post('/api/optimization/optimize')
      .send({ terminalCode: '' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/optimization/recommendations — query validation ──────────────────

describe('GET /api/optimization/recommendations — validation', () => {
  it('rejects invalid type', async () => {
    const res = await request(app)
      .get('/api/optimization/recommendations')
      .query({ type: 'INVALID_TYPE' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .get('/api/optimization/recommendations')
      .query({ status: 'INVALID_STATUS' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects limit > 100', async () => {
    const res = await request(app)
      .get('/api/optimization/recommendations')
      .query({ limit: '200' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects limit = 0', async () => {
    const res = await request(app)
      .get('/api/optimization/recommendations')
      .query({ limit: '0' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
