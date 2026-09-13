'use strict';

/**
 * PortMind AI — Response Parser
 *
 * Parses and validates AI-generated responses.
 * Provides:
 *   parseChatResponse(rawText)                    — extract answer + sections
 *   parseOperationsPlanResponse(rawText, context) — parse structured JSON plan
 *   validateReferences(response, context)         — check for invented IDs
 *   sanitizeResponse(text)                        — strip any leaked credentials
 */

const logger = require('../utils/logger');

// Patterns that must never appear in outgoing responses
const SENSITIVE_PATTERNS = [
  /apikey[=:\s]+\S+/gi,
  /access_token[=:\s]+\S+/gi,
  /bearer\s+ey[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/gi,
  /password[=:\s]+\S+/gi,
];

const VALID_RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_PRIORITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const VALID_RESOURCE_TYPES = new Set(['VESSEL', 'BERTH', 'CRANE', 'TERMINAL', 'SCHEDULE', 'GENERAL']);
const VALID_WINDOW_LABELS = ['0-12H', '12-24H', '24-48H', '48-72H'];

// ─── Sanitizer ────────────────────────────────────────────────────────────────

/**
 * Remove any accidentally leaked credentials from text.
 * @param {string} text
 * @returns {string}
 */
function sanitizeResponse(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// ─── Chat Response Parser ─────────────────────────────────────────────────────

/**
 * Parse a free-text chat response into structured sections.
 * Looks for FACTS / ACTIONS / REASONING delimiters.
 *
 * @param {string} rawText
 * @returns {{ answer: string, facts: string, actions: string, reasoning: string }}
 */
function parseChatResponse(rawText) {
  const text = sanitizeResponse((rawText || '').trim());

  // Extract labelled sections
  const factsMatch = text.match(/\bFACTS?\s*:?\s*([\s\S]*?)(?=\bACTIONS?\s*:|\bREASONING?\s*:|$)/i);
  const actionsMatch = text.match(/\bACTIONS?\s*:?\s*([\s\S]*?)(?=\bFACTS?\s*:|\bREASONING?\s*:|$)/i);
  const reasoningMatch = text.match(/\bREASONING?\s*:?\s*([\s\S]*?)(?=\bFACTS?\s*:|\bACTIONS?\s*:|$)/i);

  return {
    answer: text,
    facts: factsMatch ? factsMatch[1].trim() : '',
    actions: actionsMatch ? actionsMatch[1].trim() : '',
    reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
  };
}

// ─── Operations Plan Parser ───────────────────────────────────────────────────

/** Coerce a value to a float in [0,1]. */
function clampConfidence(val) {
  const f = parseFloat(val);
  if (isNaN(f)) return 0.75;
  return Math.min(1, Math.max(0, f));
}

/** Normalise a risk/priority level to valid enum value. */
function normaliseLevel(val, validSet, defaultVal) {
  if (!val) return defaultVal;
  const upper = String(val).toUpperCase();
  return validSet.has(upper) ? upper : defaultVal;
}

/**
 * Validate and sanitise a single plan action.
 */
function parseAction(raw) {
  return {
    action: sanitizeResponse(String(raw.action || 'Unspecified action').slice(0, 300)),
    reason: sanitizeResponse(String(raw.reason || '').slice(0, 300)),
    affectedResource: sanitizeResponse(String(raw.affectedResource || '').slice(0, 100)),
    affectedResourceType: normaliseLevel(raw.affectedResourceType, VALID_RESOURCE_TYPES, 'GENERAL'),
    expectedBenefit: sanitizeResponse(String(raw.expectedBenefit || '').slice(0, 200)),
    priority: normaliseLevel(raw.priority, VALID_PRIORITIES, 'MEDIUM'),
    confidence: clampConfidence(raw.confidence),
  };
}

/**
 * Parse a plan window.
 */
function parseWindow(raw, labelDefault) {
  const label = VALID_WINDOW_LABELS.includes(raw.label) ? raw.label : labelDefault;
  const actions = Array.isArray(raw.actions)
    ? raw.actions.slice(0, 6).map(parseAction)
    : [];
  return {
    label,
    title: sanitizeResponse(String(raw.title || label).slice(0, 100)),
    summary: sanitizeResponse(String(raw.summary || '').slice(0, 400)),
    riskLevel: normaliseLevel(raw.riskLevel, VALID_RISK_LEVELS, 'MEDIUM'),
    actions,
  };
}

/**
 * Extract JSON from a raw AI response that may contain extra text/markdown.
 * Returns parsed object or null.
 */
function extractJSON(rawText) {
  // Try direct parse
  try {
    return JSON.parse(rawText);
  } catch (_) {}

  // Try extracting from markdown fences
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch (_) {}
  }

  // Try finding the first { ... } block
  const braceMatch = rawText.match(/(\{[\s\S]*\})/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[1]);
    } catch (_) {}
  }

  return null;
}

/**
 * Parse an operations plan response (structured JSON expected).
 *
 * @param {string} rawText     — raw AI output
 * @param {object} context     — operational context (used for validation)
 * @returns {object}           — structured plan safe for DB insertion
 */
function parseOperationsPlanResponse(rawText, context) {
  const parsed = extractJSON(sanitizeResponse(rawText || ''));

  if (!parsed) {
    logger.warn('responseParser: failed to extract JSON from operations plan response');
    return buildFallbackPlan(context);
  }

  // Validate windows
  const rawWindows = Array.isArray(parsed.windows) ? parsed.windows : [];
  const windows = VALID_WINDOW_LABELS.map((label, i) => {
    const found = rawWindows.find((w) => w.label === label) || rawWindows[i] || {};
    return parseWindow(found, label);
  });

  return {
    summary: sanitizeResponse(String(parsed.summary || '').slice(0, 500)),
    overallRiskLevel: normaliseLevel(parsed.overallRiskLevel, VALID_RISK_LEVELS, 'MEDIUM'),
    windows,
    isAIGenerated: true,
    dataLabel: 'AI GENERATED · DEMO DATA',
  };
}

// ─── Reference Validator ──────────────────────────────────────────────────────

/**
 * Check that the response does not reference vessel/berth/terminal IDs
 * that don't appear in the context.
 *
 * This is a best-effort check — it warns but does not block.
 *
 * @param {object} response   — parsed response object
 * @param {object} context    — operational context
 * @returns {{ valid: boolean, warnings: string[] }}
 */
function validateReferences(response, context) {
  const warnings = [];

  // Collect known IDs from context
  const knownTerminals = new Set(
    (context.portOverview?.terminals || []).map((t) => t.code)
  );
  const knownVessels = new Set();
  const knownBerths = new Set();

  (context.berthRecommendations || []).forEach((r) => {
    if (r.vessel) knownVessels.add(r.vessel);
    if (r.recommendedBerth) knownBerths.add(r.recommendedBerth);
  });

  // Check windows
  const windows = response.windows || [];
  for (const win of windows) {
    for (const action of win.actions || []) {
      const res = action.affectedResource || '';
      // If it looks like a terminal code (T+digit) check it
      if (/^T\d+$/i.test(res) && knownTerminals.size > 0 && !knownTerminals.has(res)) {
        warnings.push(`Unknown terminal reference in plan: ${res}`);
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}

// ─── Fallback Plan ────────────────────────────────────────────────────────────

/**
 * Build a deterministic fallback plan when AI is unavailable or fails to return valid JSON.
 */
function buildFallbackPlan(context) {
  const riskLevel = context?.portOverview?.overallRiskLevel || 'MEDIUM';
  const congestionScore = context?.portOverview?.overallCongestionScore || 0;

  const overallRisk = VALID_RISK_LEVELS.has(riskLevel) ? riskLevel : 'MEDIUM';

  // Derive actions from context
  const berthRecs = context?.berthRecommendations || [];
  const craneRecs = context?.craneShortfalls || [];
  const conflicts = context?.conflicts || [];

  const immediateActions = [];

  for (const r of berthRecs.slice(0, 2)) {
    immediateActions.push({
      action: `Assign vessel ${r.vessel} to berth ${r.recommendedBerth}`,
      reason: r.reason || 'Optimized berth allocation',
      affectedResource: r.vessel || 'Vessel',
      affectedResourceType: 'VESSEL',
      expectedBenefit: 'Reduces waiting time and improves berth utilization',
      priority: 'HIGH',
      confidence: r.score ? Math.min(1, r.score) : 0.75,
    });
  }

  for (const r of craneRecs.slice(0, 2)) {
    immediateActions.push({
      action: `Resolve crane shortfall (${r.shortage} cranes) for vessel ${r.vessel}`,
      reason: r.reason || 'Crane shortage detected',
      affectedResource: r.vessel || 'Vessel',
      affectedResourceType: 'CRANE',
      expectedBenefit: 'Reduces cargo processing delay',
      priority: r.shortage >= 3 ? 'CRITICAL' : 'HIGH',
      confidence: 0.80,
    });
  }

  if (immediateActions.length === 0) {
    immediateActions.push({
      action: 'Monitor berth utilization and vessel queue levels',
      reason: 'Proactive monitoring to prevent congestion escalation',
      affectedResource: 'All Terminals',
      affectedResourceType: 'TERMINAL',
      expectedBenefit: 'Early detection of emerging congestion',
      priority: 'MEDIUM',
      confidence: 0.90,
    });
  }

  const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL').slice(0, 2);
  const shortTermActions = criticalConflicts.map((c) => ({
    action: `Resolve ${c.type}: ${(c.description || '').slice(0, 100)}`,
    reason: 'Critical conflict detected in optimization analysis',
    affectedResource: 'Port Operations',
    affectedResourceType: 'GENERAL',
    expectedBenefit: 'Prevents escalation of operational conflict',
    priority: 'CRITICAL',
    confidence: 0.80,
  }));

  if (shortTermActions.length === 0) {
    shortTermActions.push({
      action: 'Review and update vessel scheduling for optimal berth sequencing',
      reason: 'Scheduled maintenance of scheduling integrity',
      affectedResource: 'Schedule',
      affectedResourceType: 'SCHEDULE',
      expectedBenefit: 'Prevents future conflicts and delays',
      priority: 'MEDIUM',
      confidence: 0.85,
    });
  }

  return {
    summary: `Port operating at ${overallRisk} congestion risk (score: ${congestionScore.toFixed ? congestionScore.toFixed(2) : congestionScore}). Plan generated from analytical model.`,
    overallRiskLevel: overallRisk,
    windows: [
      {
        label: '0-12H',
        title: 'Immediate Actions',
        summary: 'Address current berth allocation and crane shortfalls.',
        riskLevel: overallRisk,
        actions: immediateActions,
      },
      {
        label: '12-24H',
        title: 'Short-term Adjustments',
        summary: 'Resolve scheduling conflicts and prepare for incoming vessels.',
        riskLevel: overallRisk === 'CRITICAL' ? 'HIGH' : overallRisk,
        actions: shortTermActions,
      },
      {
        label: '24-48H',
        title: 'Medium-term Planning',
        summary: 'Optimize crane deployment and berth sequencing for expected arrivals.',
        riskLevel: 'MEDIUM',
        actions: [
          {
            action: 'Forecast and pre-position crane resources for expected large vessel arrivals',
            reason: 'Proactive resource allocation based on schedule',
            affectedResource: 'Crane Fleet',
            affectedResourceType: 'CRANE',
            expectedBenefit: 'Reduces turnaround time for large vessels by 15-25%',
            priority: 'MEDIUM',
            confidence: 0.75,
          },
        ],
      },
      {
        label: '48-72H',
        title: 'Strategic Preparation',
        summary: 'Review capacity plans and coordinate with incoming vessel operators.',
        riskLevel: 'LOW',
        actions: [
          {
            action: 'Review 72-hour vessel arrival schedule and flag potential congestion points',
            reason: 'Strategic horizon planning',
            affectedResource: 'All Terminals',
            affectedResourceType: 'TERMINAL',
            expectedBenefit: 'Provides operational lead time for resource reallocation',
            priority: 'LOW',
            confidence: 0.70,
          },
        ],
      },
    ],
    isAIGenerated: false,
    dataLabel: 'FALLBACK PLAN · ANALYTICAL MODEL · DEMO DATA',
  };
}

module.exports = {
  parseChatResponse,
  parseOperationsPlanResponse,
  validateReferences,
  sanitizeResponse,
  buildFallbackPlan,
};
