'use strict';

/**
 * PortMind AI — Congestion API Integration Tests
 *
 * These tests exercise the validation middleware layer only.
 * They verify that the Express routes correctly reject malformed requests
 * (400 responses) before any database query is attempted.
 *
 * Tests that require a live MongoDB connection are excluded from this suite —
 * those are verified manually against the running application.
 */

const request = require('supertest');
const { app } = require('../src/server');

// ── POST /api/congestion/predict — input validation ───────────────────────────

describe('POST /api/congestion/predict — validation', () => {
  it('returns 400 when terminalId is missing', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({ horizon: '24H' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when horizon is missing', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({ terminalId: 'T1' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when horizon is an invalid value', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({ terminalId: 'T1', horizon: '48H' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when terminalId is empty string', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({ terminalId: '', horizon: '24H' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when horizon is a number instead of string', async () => {
    const res = await request(app)
      .post('/api/congestion/predict')
      .send({ terminalId: 'T1', horizon: 24 });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/congestion/predictions — query validation ────────────────────────

describe('GET /api/congestion/predictions — validation', () => {
  it('rejects invalid horizon query param', async () => {
    const res = await request(app)
      .get('/api/congestion/predictions')
      .query({ horizon: 'INVALID' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects horizon value not in allowed set', async () => {
    const res = await request(app)
      .get('/api/congestion/predictions')
      .query({ horizon: '48H' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects limit > 100', async () => {
    const res = await request(app)
      .get('/api/congestion/predictions')
      .query({ limit: '200' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/congestion/history — query validation ────────────────────────────

describe('GET /api/congestion/history — validation', () => {
  it('rejects days = 0', async () => {
    const res = await request(app)
      .get('/api/congestion/history')
      .query({ days: '0' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects days > 365', async () => {
    const res = await request(app)
      .get('/api/congestion/history')
      .query({ days: '400' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects days as a non-integer', async () => {
    const res = await request(app)
      .get('/api/congestion/history')
      .query({ days: 'abc' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
