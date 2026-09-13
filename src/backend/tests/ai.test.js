'use strict';

/**
 * PortMind AI — AI Integration Tests (Phase 7)
 *
 * Tests:
 *   1. Request validation (empty/missing message → 400)
 *   2. Fallback response when watsonx is not configured
 *   3. Context structure from aiService
 *   4. Operations plan API validation
 *   5. Response parser unit tests
 *
 * Strategy:
 *   - Jest module mock for watsonxProvider (no real HTTP calls)
 *   - Jest module mock for contextBuilder (deterministic context)
 *   - Supertest for Express endpoint integration
 *   - Authentication handled via real JWT generation
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');

// ─── Mock watsonxProvider before any require ─────────────────────────────────

jest.mock('../src/ai/watsonxProvider', () => ({
  generate: jest.fn(),
  isConfigured: jest.fn(() => false), // default: not configured
  getStatus: jest.fn(() => ({
    configured: false,
    modelId: 'ibm/granite-13b-chat-v2',
    url: 'https://us-south.ml.cloud.ibm.com',
    projectIdSet: false,
    apiKeySet: false,
  })),
  _invalidateTokenForTest: jest.fn(),
}));

// ─── Mock contextBuilder to avoid DB calls ───────────────────────────────────

jest.mock('../src/ai/contextBuilder', () => ({
  buildConversationalContext: jest.fn(async (query) => ({
    timestamp: new Date().toISOString(),
    userQuery: query,
    portOverview: {
      overallCongestionScore: 0.45,
      overallRiskLevel: 'MEDIUM',
      terminals: [
        { code: 'T1', name: 'Terminal 1', riskLevel: 'MEDIUM', congestionScore: 0.45 },
      ],
    },
    optimizationSummary: { berthRecommendations: 2 },
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
    recentAlerts: [],
    dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
  })),
  buildCongestionExplanationContext: jest.fn(async (code) => {
    if (code === 'NOTFOUND') {
      return { error: 'Terminal NOTFOUND not found', availableTerminals: ['T1', 'T2'] };
    }
    return {
      timestamp: new Date().toISOString(),
      targetTerminal: {
        code,
        name: `Terminal ${code}`,
        riskLevel: 'HIGH',
        congestionScore: 0.72,
        snapshot: { berths: {}, vessels: {}, cranes: {} },
      },
      otherTerminals: [],
      recentAlerts: [],
      dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
    };
  }),
  buildOperationsPlanContext: jest.fn(async () => ({
    timestamp: new Date().toISOString(),
    planHorizon: '72H',
    portOverview: {
      overallCongestionScore: 0.55,
      overallRiskLevel: 'MEDIUM',
      terminals: [
        { code: 'T1', riskLevel: 'MEDIUM', congestionScore: 0.55, factorBreakdown: {} },
      ],
    },
    resourceUtilization: {},
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
    recentAlerts: [],
    dataLabel: 'ANALYTICAL MODEL — DEMO DATA',
  })),
}));

// ─── Mock operationsPlanService to avoid DB calls ────────────────────────────

jest.mock('../src/services/operationsPlanService', () => ({
  generatePlan: jest.fn(async () => ({
    _id: 'mock-plan-id',
    planId: 'PLAN-12345',
    horizon: '72H',
    generatedBy: 'SYSTEM',
    overallRiskLevel: 'MEDIUM',
    summary: 'Mock plan summary',
    windows: [
      {
        label: '0-12H',
        title: 'Immediate Actions',
        summary: 'Monitor operations',
        riskLevel: 'MEDIUM',
        actions: [
          {
            action: 'Monitor berth utilization',
            reason: 'Proactive monitoring',
            affectedResource: 'All Terminals',
            affectedResourceType: 'TERMINAL',
            priority: 'MEDIUM',
            confidence: 0.8,
          },
        ],
      },
      { label: '12-24H', title: 'Short-term Adjustments', summary: '...', riskLevel: 'MEDIUM', actions: [] },
      { label: '24-48H', title: 'Medium-term Planning', summary: '...', riskLevel: 'LOW', actions: [] },
      { label: '48-72H', title: 'Strategic Preparation', summary: '...', riskLevel: 'LOW', actions: [] },
    ],
    isFallback: true,
    fallbackReason: 'WATSONX_NOT_CONFIGURED',
    dataLabel: 'FALLBACK PLAN · ANALYTICAL MODEL · DEMO DATA',
    isDemoData: true,
  })),
  listPlans: jest.fn(async () => []),
  getPlanById: jest.fn(async () => null),
}));

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const config = require('../src/config/env');

function getAuthToken() {
  return jwt.sign(
    { username: config.demoUsername, role: 'admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

// ─── GET /api/ai/status ───────────────────────────────────────────────────────

describe('GET /api/ai/status', () => {
  it('returns 200 with configured: false when watsonx is not set', async () => {
    const token = getAuthToken();
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('configured', false);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.statusCode).toBe(401);
  });
});

// ─── POST /api/ai/chat — validation ──────────────────────────────────────────

describe('POST /api/ai/chat — request validation', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message is empty string', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message is whitespace only', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '   ' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message exceeds 1000 characters', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'a'.repeat(1001) });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'hello' });

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with fallback response when watsonx is not configured', async () => {
    const watsonxProvider = require('../src/ai/watsonxProvider');
    watsonxProvider.isConfigured.mockReturnValue(false);

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What is the current congestion level?' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('isFallback', true);
    expect(res.body.data).toHaveProperty('answer');
    expect(typeof res.body.data.answer).toBe('string');
    expect(res.body.data.answer.length).toBeGreaterThan(0);
  });

  it('returns 200 with AI response when watsonx returns text', async () => {
    const watsonxProvider = require('../src/ai/watsonxProvider');
    watsonxProvider.isConfigured.mockReturnValue(true);
    watsonxProvider.generate.mockResolvedValue(
      'FACTS: Terminal T1 is at MEDIUM congestion (0.45 score).\nACTIONS: No immediate action required.\nREASONING: Congestion score is below HIGH threshold.'
    );

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What is the congestion level?' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isFallback).toBe(false);
    expect(res.body.data.answer).toContain('MEDIUM');

    // Reset mock
    watsonxProvider.isConfigured.mockReturnValue(false);
    watsonxProvider.generate.mockReset();
  });
});

// ─── POST /api/ai/explain-congestion — validation ────────────────────────────

describe('POST /api/ai/explain-congestion — validation', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('returns 400 when neither terminalCode nor terminalId provided', async () => {
    const res = await request(app)
      .post('/api/ai/explain-congestion')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when terminal does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/explain-congestion')
      .set('Authorization', `Bearer ${token}`)
      .send({ terminalCode: 'NOTFOUND' });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with fallback when watsonx not configured', async () => {
    const res = await request(app)
      .post('/api/ai/explain-congestion')
      .set('Authorization', `Bearer ${token}`)
      .send({ terminalCode: 'T1' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('terminalCode', 'T1');
    expect(res.body.data).toHaveProperty('isFallback', true);
  });

  it('accepts terminalId (legacy field)', async () => {
    const res = await request(app)
      .post('/api/ai/explain-congestion')
      .set('Authorization', `Bearer ${token}`)
      .send({ terminalId: 'T1' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('terminalCode', 'T1');
  });
});

// ─── POST /api/ai/analyze ─────────────────────────────────────────────────────

describe('POST /api/ai/analyze — validation', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/api/ai/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 for type=vessel with fallback', async () => {
    const res = await request(app)
      .post('/api/ai/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'vessel', id: 'V-TEST-1' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/ai/operations-plan ────────────────────────────────────────────

describe('POST /api/ai/operations-plan', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/ai/operations-plan');

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with a plan (fallback when watsonx not configured)', async () => {
    const res = await request(app)
      .post('/api/ai/operations-plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('planId');
    expect(res.body.data).toHaveProperty('windows');
    expect(Array.isArray(res.body.data.windows)).toBe(true);
    expect(res.body.data.windows.length).toBe(4);
  });

  it('windows have required labels', async () => {
    const res = await request(app)
      .post('/api/ai/operations-plan')
      .set('Authorization', `Bearer ${token}`);

    const labels = res.body.data.windows.map((w) => w.label);
    expect(labels).toContain('0-12H');
    expect(labels).toContain('12-24H');
    expect(labels).toContain('24-48H');
    expect(labels).toContain('48-72H');
  });
});

// ─── GET /api/operations-plan — list ─────────────────────────────────────────

describe('GET /api/operations-plan', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/operations-plan');
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with array', async () => {
    const res = await request(app)
      .get('/api/operations-plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── GET /api/operations-plan/:id ────────────────────────────────────────────

describe('GET /api/operations-plan/:id', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  it('returns 404 for unknown plan id', async () => {
    const res = await request(app)
      .get('/api/operations-plan/nonexistent-plan-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── responseParser unit tests ────────────────────────────────────────────────

describe('responseParser.parseChatResponse', () => {
  const { parseChatResponse } = require('../src/ai/responseParser');

  it('extracts facts, actions, reasoning sections', () => {
    const text = `FACTS: Terminal T1 is at HIGH risk.
ACTIONS: Reallocate berths immediately.
REASONING: Congestion score exceeds 0.60 threshold.`;

    const result = parseChatResponse(text);
    expect(result.facts).toContain('Terminal T1');
    expect(result.actions).toContain('Reallocate');
    expect(result.reasoning).toContain('Congestion score');
    expect(result.answer).toBe(text);
  });

  it('returns answer with no sections for plain text', () => {
    const text = 'This is a plain response with no sections.';
    const result = parseChatResponse(text);
    expect(result.answer).toBe(text);
    expect(result.facts).toBe('');
    expect(result.actions).toBe('');
    expect(result.reasoning).toBe('');
  });

  it('sanitizes sensitive patterns', () => {
    const { sanitizeResponse } = require('../src/ai/responseParser');
    const text = 'apikey=supersecret123 and password=abc123';
    const result = sanitizeResponse(text);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('supersecret123');
    expect(result).not.toContain('abc123');
  });
});

describe('responseParser.parseOperationsPlanResponse', () => {
  const { parseOperationsPlanResponse, buildFallbackPlan } = require('../src/ai/responseParser');

  const mockContext = {
    portOverview: { overallCongestionScore: 0.5, overallRiskLevel: 'MEDIUM' },
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
  };

  it('parses valid JSON plan response', () => {
    const planJSON = JSON.stringify({
      summary: 'Port at MEDIUM risk',
      overallRiskLevel: 'MEDIUM',
      windows: [
        {
          label: '0-12H',
          title: 'Immediate Actions',
          summary: 'Monitor operations',
          riskLevel: 'MEDIUM',
          actions: [
            {
              action: 'Monitor vessel queue',
              reason: 'Elevated queue detected',
              affectedResource: 'T1',
              affectedResourceType: 'TERMINAL',
              expectedBenefit: 'Early warning',
              priority: 'MEDIUM',
              confidence: 0.85,
            },
          ],
        },
        { label: '12-24H', title: 'Short-term', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '24-48H', title: 'Medium-term', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '48-72H', title: 'Strategic', summary: '', riskLevel: 'LOW', actions: [] },
      ],
    });

    const result = parseOperationsPlanResponse(planJSON, mockContext);
    expect(result.overallRiskLevel).toBe('MEDIUM');
    expect(result.windows).toHaveLength(4);
    expect(result.windows[0].label).toBe('0-12H');
    expect(result.windows[0].actions[0].confidence).toBe(0.85);
    expect(result.isAIGenerated).toBe(true);
  });

  it('returns fallback plan when JSON is invalid', () => {
    const result = parseOperationsPlanResponse('not valid json at all', mockContext);
    expect(result.isAIGenerated).toBe(false);
    expect(result.windows).toHaveLength(4);
  });

  it('builds a fallback plan with correct structure', () => {
    const fallback = buildFallbackPlan(mockContext);
    expect(fallback.windows).toHaveLength(4);
    expect(fallback.isAIGenerated).toBe(false);
    const labels = fallback.windows.map((w) => w.label);
    expect(labels).toEqual(['0-12H', '12-24H', '24-48H', '48-72H']);
  });

  it('clamps confidence values to [0, 1]', () => {
    const planJSON = JSON.stringify({
      summary: 'test',
      overallRiskLevel: 'LOW',
      windows: [
        {
          label: '0-12H',
          title: 'Test',
          summary: '',
          riskLevel: 'LOW',
          actions: [
            { action: 'act', reason: 'r', priority: 'LOW', confidence: 1.5 },
          ],
        },
        { label: '12-24H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '24-48H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '48-72H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
      ],
    });
    const result = parseOperationsPlanResponse(planJSON, mockContext);
    expect(result.windows[0].actions[0].confidence).toBe(1);
  });

  it('normalises invalid risk level to MEDIUM', () => {
    const planJSON = JSON.stringify({
      summary: 'test',
      overallRiskLevel: 'INVALID_LEVEL',
      windows: [
        { label: '0-12H', title: '', summary: '', riskLevel: 'INVALID', actions: [] },
        { label: '12-24H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '24-48H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
        { label: '48-72H', title: '', summary: '', riskLevel: 'LOW', actions: [] },
      ],
    });
    const result = parseOperationsPlanResponse(planJSON, mockContext);
    expect(result.overallRiskLevel).toBe('MEDIUM');
    expect(result.windows[0].riskLevel).toBe('MEDIUM');
  });
});

// ─── aiService context structure tests ───────────────────────────────────────

describe('aiService context structure (mocked)', () => {
  const contextBuilder = require('../src/ai/contextBuilder');

  it('buildConversationalContext returns portOverview with terminals', async () => {
    const ctx = await contextBuilder.buildConversationalContext('test query');
    expect(ctx).toHaveProperty('portOverview');
    expect(ctx.portOverview).toHaveProperty('terminals');
    expect(Array.isArray(ctx.portOverview.terminals)).toBe(true);
    expect(ctx.userQuery).toBe('test query');
  });

  it('buildCongestionExplanationContext returns targetTerminal for valid code', async () => {
    const ctx = await contextBuilder.buildCongestionExplanationContext('T1');
    expect(ctx).toHaveProperty('targetTerminal');
    expect(ctx.targetTerminal.code).toBe('T1');
    expect(ctx.targetTerminal).toHaveProperty('congestionScore');
  });

  it('buildCongestionExplanationContext returns error for unknown terminal', async () => {
    const ctx = await contextBuilder.buildCongestionExplanationContext('NOTFOUND');
    expect(ctx).toHaveProperty('error');
    expect(ctx.error).toContain('not found');
  });

  it('buildOperationsPlanContext returns 72H horizon', async () => {
    const ctx = await contextBuilder.buildOperationsPlanContext();
    expect(ctx.planHorizon).toBe('72H');
    expect(ctx).toHaveProperty('portOverview');
  });
});

// ─── promptBuilder unit tests ─────────────────────────────────────────────────

describe('promptBuilder', () => {
  const { buildChatPrompt, buildCongestionExplainPrompt, buildOperationsPlanPrompt, SYSTEM_PROMPT } =
    require('../src/ai/promptBuilder');

  const mockCtx = {
    portOverview: { overallRiskLevel: 'MEDIUM', overallCongestionScore: 0.45, terminals: [] },
    berthRecommendations: [],
    craneShortfalls: [],
    conflicts: [],
    recentAlerts: [],
    dataLabel: 'DEMO',
  };

  it('buildChatPrompt includes system prompt', () => {
    const prompt = buildChatPrompt(mockCtx, 'test question');
    expect(prompt).toContain('PortMind Copilot');
    expect(prompt).toContain('test question');
  });

  it('buildChatPrompt includes context data', () => {
    const prompt = buildChatPrompt(mockCtx, 'question');
    expect(prompt).toContain('MEDIUM');
  });

  it('buildCongestionExplainPrompt handles terminal not found', () => {
    const ctx = { error: 'Terminal XYZ not found', terminalCode: 'XYZ', availableTerminals: ['T1'] };
    const prompt = buildCongestionExplainPrompt(ctx);
    expect(prompt).toContain('XYZ');
    expect(prompt).toContain('T1');
  });

  it('buildOperationsPlanPrompt requests JSON output', () => {
    const ctx = { ...mockCtx, planHorizon: '72H', resourceUtilization: {} };
    const prompt = buildOperationsPlanPrompt(ctx);
    expect(prompt).toContain('"windows"');
    expect(prompt).toContain('0-12H');
    expect(prompt).toContain('48-72H');
  });

  it('SYSTEM_PROMPT contains grounding constraints', () => {
    expect(SYSTEM_PROMPT).toContain('STRICT GROUNDING RULES');
    expect(SYSTEM_PROMPT).toContain('Do not invent');
  });
});
