'use strict';

/**
 * PortMind AI — AI Service
 *
 * Orchestrates the full AI pipeline:
 *   contextBuilder → promptBuilder → watsonxProvider → responseParser
 *
 * Public methods:
 *   chat(message)                    — conversational query
 *   explainCongestion(terminalCode)  — root-cause explanation for a terminal
 *   generateOperationsPlan()         — 72-hour structured plan
 *   getStatus()                      — watsonx configuration status
 */

const watsonxProvider = require('./watsonxProvider');
const contextBuilder = require('./contextBuilder');
const promptBuilder = require('./promptBuilder');
const responseParser = require('./responseParser');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to call watsonx. On known non-AI errors, return a fallback label.
 * Returns { text: string, isFallback: boolean, fallbackReason: string|null }
 */
async function callWatsonx(prompt, options = {}) {
  if (!watsonxProvider.isConfigured()) {
    return {
      text: null,
      isFallback: true,
      fallbackReason: 'WATSONX_NOT_CONFIGURED',
    };
  }

  try {
    const text = await watsonxProvider.generate(prompt, options);
    return { text, isFallback: false, fallbackReason: null };
  } catch (err) {
    if (err.message === 'WATSONX_NOT_CONFIGURED') {
      return { text: null, isFallback: true, fallbackReason: 'WATSONX_NOT_CONFIGURED' };
    }
    if (err.message === 'WATSONX_RATE_LIMITED') {
      return { text: null, isFallback: true, fallbackReason: 'WATSONX_RATE_LIMITED' };
    }
    logger.error('aiService: watsonx call failed', { message: err.message });
    return { text: null, isFallback: true, fallbackReason: err.message };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Conversational chat query.
 *
 * @param {string} message  — user's natural-language question
 * @returns {object}        — { answer, facts, actions, reasoning, isFallback, fallbackReason, dataLabel }
 */
async function chat(message) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw Object.assign(new Error('Message is required'), { statusCode: 400 });
  }

  const trimmed = message.trim().slice(0, 1000);

  const context = await contextBuilder.buildConversationalContext(trimmed);
  const prompt = promptBuilder.buildChatPrompt(context, trimmed);

  const { text, isFallback, fallbackReason } = await callWatsonx(prompt, { maxTokens: 700 });

  if (isFallback || !text) {
    const fallbackMessage = fallbackReason === 'WATSONX_NOT_CONFIGURED'
      ? 'IBM watsonx.ai is not configured. To enable AI responses, set WATSONX_API_KEY and WATSONX_PROJECT_ID in your environment.'
      : fallbackReason === 'WATSONX_RATE_LIMITED'
      ? 'AI service is temporarily rate-limited. Please try again in a moment.'
      : 'AI service is temporarily unavailable. Please try again shortly.';

    return {
      answer: fallbackMessage,
      facts: '',
      actions: '',
      reasoning: '',
      isFallback: true,
      fallbackReason,
      context: context.portOverview || {},
      dataLabel: 'FALLBACK RESPONSE — NOT AI GENERATED',
    };
  }

  const parsed = responseParser.parseChatResponse(text);

  return {
    ...parsed,
    isFallback: false,
    fallbackReason: null,
    context: context.portOverview || {},
    dataLabel: 'AI GENERATED · IBM watsonx.ai · DEMO DATA',
  };
}

/**
 * Explain congestion root causes for a terminal.
 *
 * @param {string} terminalCode  — e.g. "T1"
 * @returns {object}             — { explanation, facts, actions, reasoning, isFallback, ... }
 */
async function explainCongestion(terminalCode) {
  if (!terminalCode || typeof terminalCode !== 'string') {
    throw Object.assign(new Error('terminalCode is required'), { statusCode: 400 });
  }

  const code = terminalCode.trim().toUpperCase();
  const context = await contextBuilder.buildCongestionExplanationContext(code);

  if (context.error && context.error.includes('not found')) {
    throw Object.assign(
      new Error(`Terminal '${code}' not found`),
      { statusCode: 404 }
    );
  }

  const prompt = promptBuilder.buildCongestionExplainPrompt(context);
  const { text, isFallback, fallbackReason } = await callWatsonx(prompt, { maxTokens: 600 });

  if (isFallback || !text) {
    const riskLevel = context.targetTerminal?.riskLevel || 'UNKNOWN';
    const score = context.targetTerminal?.congestionScore ?? 'N/A';
    return {
      explanation: `[FALLBACK — NOT AI GENERATED] Terminal ${code} congestion level: ${riskLevel} (score: ${score}). Configure watsonx.ai for detailed analysis.`,
      facts: '',
      actions: '',
      reasoning: '',
      terminalCode: code,
      context: context.targetTerminal || {},
      isFallback: true,
      fallbackReason,
      dataLabel: 'FALLBACK RESPONSE — NOT AI GENERATED',
    };
  }

  const parsed = responseParser.parseChatResponse(text);

  return {
    explanation: parsed.answer,
    facts: parsed.facts,
    actions: parsed.actions,
    reasoning: parsed.reasoning,
    terminalCode: code,
    context: context.targetTerminal || {},
    isFallback: false,
    fallbackReason: null,
    dataLabel: 'AI GENERATED · IBM watsonx.ai · DEMO DATA',
  };
}

/**
 * Generate a 72-hour operations plan.
 *
 * @returns {object}  — parsed plan with windows, summary, riskLevel, dataLabel
 */
async function generateOperationsPlan() {
  const context = await contextBuilder.buildOperationsPlanContext();

  const prompt = promptBuilder.buildOperationsPlanPrompt(context);
  const { text, isFallback, fallbackReason } = await callWatsonx(prompt, {
    maxTokens: 1000,
    repetitionPenalty: 1.1,
  });

  if (isFallback || !text) {
    logger.info('aiService.generateOperationsPlan: using fallback plan', { fallbackReason });
    const fallback = responseParser.buildFallbackPlan(context);
    return {
      ...fallback,
      isFallback: true,
      fallbackReason,
      generatedBy: 'SYSTEM',
    };
  }

  const plan = responseParser.parseOperationsPlanResponse(text, context);

  // Reference validation (warn only)
  const { warnings } = responseParser.validateReferences(plan, context);
  if (warnings.length > 0) {
    logger.warn('aiService.generateOperationsPlan: reference validation warnings', { warnings });
  }

  return {
    ...plan,
    isFallback: false,
    fallbackReason: null,
    generatedBy: 'AI_ENGINE',
  };
}

/**
 * Return watsonx configuration status.
 */
function getStatus() {
  return watsonxProvider.getStatus();
}

module.exports = { chat, explainCongestion, generateOperationsPlan, getStatus };
