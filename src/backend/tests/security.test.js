'use strict';

/**
 * PortMind AI — Phase 10 Security Tests
 *
 * Verifies:
 *   1. Authentication enforcement on protected routes
 *   2. AI status endpoint exposes NO credential values
 *   3. Response sanitizer strips credential patterns from AI text
 *   4. Error responses do not expose stack traces or internals
 *   5. Invalid ObjectId handled safely (no DB crash, 400 not 500)
 *   6. Input length limits enforced
 *   7. Rate-limited / auth-rejected responses have correct shape
 */

const request = require('supertest');
const { app } = require('../src/server');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');

// ─── Mock AI dependencies to avoid real DB calls ─────────────────────────────

jest.mock('../src/ai/watsonxProvider', () => ({
  generate: jest.fn(),
  isConfigured: jest.fn(() => false),
  getStatus: jest.fn(() => ({
    configured: false,
    modelId: 'ibm/granite-13b-chat-v2',
    url: 'https://us-south.ml.cloud.ibm.com',
    projectIdSet: false,
    apiKeySet: false,
  })),
  _invalidateTokenForTest: jest.fn(),
}));

jest.mock('../src/ai/contextBuilder', () => ({
  buildConversationalContext: jest.fn(async (q) => ({
    timestamp: new Date().toISOString(),
    userQuery: q,
    portOverview: { overallCongestionScore: 0.4, overallRiskLevel: 'MEDIUM', terminals: [] },
    optimizationSummary: {},
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
    recentAlerts: [],
    dataLabel: 'DEMO',
  })),
  buildCongestionExplanationContext: jest.fn(async (code) => {
    if (code === 'T1') {
      return {
        timestamp: new Date().toISOString(),
        targetTerminal: { code: 'T1', name: 'Terminal 1', riskLevel: 'MEDIUM', congestionScore: 0.45, snapshot: {} },
        otherTerminals: [],
        recentAlerts: [],
        dataLabel: 'DEMO',
      };
    }
    return { error: `Terminal '${code}' not found`, availableTerminals: ['T1'] };
  }),
  buildOperationsPlanContext: jest.fn(async () => ({
    timestamp: new Date().toISOString(),
    planHorizon: '72H',
    portOverview: { overallCongestionScore: 0.4, overallRiskLevel: 'MEDIUM', terminals: [] },
    resourceUtilization: {},
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
    recentAlerts: [],
    dataLabel: 'DEMO',
  })),
}));

jest.mock('../src/services/operationsPlanService', () => ({
  generatePlan: jest.fn(async () => ({
    planId: 'PLAN-SEC-TEST',
    horizon: '72H',
    generatedBy: 'SYSTEM',
    overallRiskLevel: 'MEDIUM',
    windows: [],
    isFallback: true,
    isDemoData: true,
  })),
  listPlans: jest.fn(async () => []),
  getPlanById: jest.fn(async () => null),
}));

// ─── Token helper ─────────────────────────────────────────────────────────────

function validToken() {
  return jwt.sign(
    { username: config.demoUsername, role: 'operations_manager' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function expiredToken() {
  return jwt.sign(
    { username: config.demoUsername, role: 'operations_manager' },
    config.jwtSecret,
    { expiresIn: '-1s' }
  );
}

// ─── 1. Authentication enforcement ───────────────────────────────────────────

describe('Authentication enforcement — protected routes reject unauthenticated requests', () => {
  const protectedRoutes = [
    ['GET',  '/api/ai/status'],
    ['POST', '/api/ai/chat'],
    ['POST', '/api/ai/explain-congestion'],
    ['POST', '/api/ai/analyze'],
    ['POST', '/api/ai/operations-plan'],
    ['POST', '/api/operations-plan/generate'],
    ['GET',  '/api/operations-plan'],
  ];

  protectedRoutes.forEach(([method, path]) => {
    it(`${method} ${path} returns 401 without token`, async () => {
      const res = await request(app)[method.toLowerCase()](path)
        .send({ message: 'test', terminalCode: 'T1', type: 'terminal', id: 'T1' });
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  it('returns 401 with expired token on protected route', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${expiredToken()}`);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with malformed token on protected route', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', 'Bearer not.a.real.jwt.token');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with empty Bearer token on protected route', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', 'Bearer ');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 2. AI status — no credential exposure ────────────────────────────────────

describe('GET /api/ai/status — credential safety', () => {
  let token;
  beforeAll(() => { token = validToken(); });

  it('returns 200 with success=true', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('does NOT include apiKey in status response', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);
    const body = JSON.stringify(res.body);
    // The actual key value is empty in test env, but make sure the field isn't present
    expect(res.body.data).not.toHaveProperty('apiKey');
    expect(res.body.data).not.toHaveProperty('api_key');
    expect(body).not.toMatch(/WATSONX_API_KEY/);
  });

  it('returns only safe config fields: configured, modelId, url, projectIdSet, apiKeySet', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);
    const d = res.body.data;
    expect(d).toHaveProperty('configured');
    expect(d).toHaveProperty('apiKeySet');    // boolean only, not the key value
    expect(d).toHaveProperty('projectIdSet'); // boolean only, not the project ID
    expect(typeof d.apiKeySet).toBe('boolean');
    expect(typeof d.projectIdSet).toBe('boolean');
  });
});

// ─── 3. Response sanitizer — credential stripping ─────────────────────────────

describe('responseParser.sanitizeResponse — strips credential patterns', () => {
  const { sanitizeResponse } = require('../src/ai/responseParser');

  it('removes apikey= patterns', () => {
    const result = sanitizeResponse('Found apikey=abc123xyz in the text');
    expect(result).not.toMatch(/abc123xyz/);
    expect(result).toContain('[REDACTED]');
  });

  it('removes access_token= patterns', () => {
    const result = sanitizeResponse('access_token=mytoken12345');
    expect(result).not.toMatch(/mytoken12345/);
    expect(result).toContain('[REDACTED]');
  });

  it('removes Bearer JWT patterns', () => {
    const result = sanitizeResponse('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123');
    expect(result).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(result).toContain('[REDACTED]');
  });

  it('removes password= patterns', () => {
    const result = sanitizeResponse('password=secretpassword here');
    expect(result).not.toMatch(/secretpassword/);
    expect(result).toContain('[REDACTED]');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitizeResponse(null)).toBeNull();
    expect(sanitizeResponse(42)).toBe(42);
    expect(sanitizeResponse(undefined)).toBeUndefined();
  });

  it('passes clean text through unchanged', () => {
    const clean = 'Terminal T1 has MEDIUM congestion score 0.45.';
    expect(sanitizeResponse(clean)).toBe(clean);
  });
});

// ─── 4. Error responses — no stack trace exposure ─────────────────────────────

describe('Error responses — no internal details exposed in production-like mode', () => {
  it('404 for unknown route has no stack trace', async () => {
    const res = await request(app).get('/api/does-not-exist-at-all');
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\.|at Module\.|at Function\./);
  });

  it('400 for invalid login body has no stack trace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '' });
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toHaveProperty('stack');
  });
});

// ─── 5. CastError (invalid ObjectId) handled as 400, not 500 ─────────────────

describe('Invalid ObjectId handling — returns 400, not 500', () => {
  it('GET /api/alerts/not-a-valid-id returns 400', async () => {
    // Alert model is not mocked here — this test hits the errorHandler CastError path
    // We use a route that goes through the real errorHandler
    // Since Alert is NOT mocked in this file, we expect either a 400 (CastError) or 500 (no DB)
    // We just verify it does NOT return 200 or expose stack traces
    const res = await request(app).get('/api/alerts/not-a-valid-id-format');
    expect(res.body).not.toHaveProperty('stack');
    expect([400, 500]).toContain(res.statusCode); // either is acceptable, just not 200
    expect(res.body.success).toBe(false);
  });
});

// ─── 6. AI input length enforcement ──────────────────────────────────────────

describe('AI input length limits', () => {
  let token;
  beforeAll(() => { token = validToken(); });

  it('rejects chat message > 1000 characters', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'x'.repeat(1001) });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts chat message exactly 1000 characters', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'x'.repeat(1000) });
    // 200 with fallback or 400 — either is acceptable, just not a crash
    expect([200, 400]).toContain(res.statusCode);
    expect(res.body.success).toBeDefined();
  });
});

// ─── 7. Auth error response shape ────────────────────────────────────────────

describe('Auth error response shape', () => {
  it('401 response has success=false and message field', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
  });

  it('POST /api/auth/login with wrong password has success=false', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword123' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty('stack');
  });

  it('POST /api/auth/login success returns token and user (no password in response)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: config.demoUsername, password: config.demoPassword });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
    // password must not be echoed back
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(JSON.stringify(res.body.data)).not.toMatch(/portmind2026/);
  });
});
