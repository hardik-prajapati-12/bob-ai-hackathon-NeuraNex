'use strict';

/**
 * PortMind AI — Prompt Builder
 *
 * Constructs grounded prompts for IBM watsonx.ai (Granite chat model).
 * All prompts:
 *   - Ground the model in provided operational context only
 *   - Forbid invented vessel/berth IDs
 *   - Label facts vs recommendations
 *   - Use a structured output format: FACTS / ACTIONS / REASONING
 */

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are PortMind Copilot, an AI assistant for container port operations management. You are embedded in PortMind AI, an intelligent port congestion prediction and optimisation platform.

STRICT GROUNDING RULES:
1. Use ONLY the operational data provided in the context. Do not invent vessel IDs, berth IDs, terminal codes, or statistics.
2. When referencing vessels, berths, or terminals, use only IDs/codes that appear in the context.
3. Clearly distinguish FACTS (from the data) from RECOMMENDATIONS (your analysis).
4. If the context lacks information to answer the question, say so explicitly.
5. Be concise and actionable. Port operators need clear, structured answers.
6. All numerical values must match the context — never round or fabricate numbers.

RESPONSE FORMAT:
Structure your response with clearly labeled sections as needed:
- FACTS: Key observations from the operational data
- ACTIONS: Specific recommended steps (if applicable)
- REASONING: Brief explanation of your analysis

Keep responses focused and under 400 words unless a detailed plan is explicitly requested.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compact JSON serialisation — removes undefined values. */
function compactJSON(obj) {
  return JSON.stringify(obj, null, 0);
}

/** Truncate context string to a safe token budget (~2800 chars ≈ ~700 tokens). */
function truncateContext(str, maxChars = 2800) {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '\n...[context truncated]';
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

/**
 * Build a conversational chat prompt.
 * @param {object} context  — from contextBuilder.buildConversationalContext
 * @param {string} userMessage
 * @returns {string}  full prompt
 */
function buildChatPrompt(context, userMessage) {
  const contextStr = truncateContext(compactJSON(context));

  return `${SYSTEM_PROMPT}

=== CURRENT OPERATIONAL CONTEXT ===
${contextStr}

=== USER QUESTION ===
${userMessage}

=== YOUR RESPONSE ===`;
}

/**
 * Build a congestion explanation prompt.
 * @param {object} context  — from contextBuilder.buildCongestionExplanationContext
 * @returns {string}  full prompt
 */
function buildCongestionExplainPrompt(context) {
  if (context.error) {
    return `${SYSTEM_PROMPT}

The user requested a congestion explanation for terminal "${context.terminalCode}", but this terminal was not found in the operational data.
Available terminals: ${(context.availableTerminals || []).join(', ')}.
Please inform the user and suggest checking the terminal code.

=== YOUR RESPONSE ===`;
  }

  const contextStr = truncateContext(compactJSON(context));
  const riskLevel = context.targetTerminal?.riskLevel || 'UNKNOWN';
  const score = context.targetTerminal?.congestionScore ?? 'N/A';
  const terminalCode = context.targetTerminal?.code || '';

  return `${SYSTEM_PROMPT}

=== CONGESTION CONTEXT FOR TERMINAL ${terminalCode} ===
Risk Level: ${riskLevel} | Congestion Score: ${score}
${contextStr}

=== TASK ===
Explain the root causes of the current congestion level at terminal ${terminalCode}.
Use the factor breakdown and snapshot data to identify the primary drivers.
Provide specific, actionable recommendations to reduce congestion.
Structure your response with: FACTS, ACTIONS, REASONING.

=== YOUR RESPONSE ===`;
}

/**
 * Build the 72-hour operations plan prompt.
 * @param {object} context  — from contextBuilder.buildOperationsPlanContext
 * @returns {string}  full prompt
 */
function buildOperationsPlanPrompt(context) {
  const contextStr = truncateContext(compactJSON(context), 3200);

  return `${SYSTEM_PROMPT}

=== CURRENT PORT OPERATIONAL CONTEXT ===
${contextStr}

=== TASK: GENERATE 72-HOUR OPERATIONS PLAN ===
Generate a structured 72-hour operations plan divided into four time windows:
  - Window 1: 0-12H (Immediate actions)
  - Window 2: 12-24H (Short-term adjustments)
  - Window 3: 24-48H (Medium-term planning)
  - Window 4: 48-72H (Strategic preparation)

For each window, provide:
  - A brief summary of the operational outlook
  - 2-4 specific actions (each with: action description, reason, affected resource, priority [CRITICAL/HIGH/MEDIUM/LOW], confidence [0.0-1.0])

STRICT RULES:
- Base every action on data in the context above
- Reference only vessel/berth/terminal IDs that appear in the context
- Do NOT invent statistics or future events not implied by the data
- Mark the overall plan as DEMO DATA

Respond in this EXACT JSON format (valid JSON only, no markdown fences):
{
  "summary": "Brief 1-2 sentence overall assessment",
  "overallRiskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "windows": [
    {
      "label": "0-12H",
      "title": "Immediate Actions",
      "summary": "...",
      "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
      "actions": [
        {
          "action": "...",
          "reason": "...",
          "affectedResource": "...",
          "affectedResourceType": "VESSEL|BERTH|CRANE|TERMINAL|SCHEDULE|GENERAL",
          "expectedBenefit": "...",
          "priority": "CRITICAL|HIGH|MEDIUM|LOW",
          "confidence": 0.85
        }
      ]
    },
    { "label": "12-24H", "title": "Short-term Adjustments", "summary": "...", "riskLevel": "...", "actions": [] },
    { "label": "24-48H", "title": "Medium-term Planning", "summary": "...", "riskLevel": "...", "actions": [] },
    { "label": "48-72H", "title": "Strategic Preparation", "summary": "...", "riskLevel": "...", "actions": [] }
  ]
}

=== YOUR RESPONSE (JSON only) ===`;
}

module.exports = {
  SYSTEM_PROMPT,
  buildChatPrompt,
  buildCongestionExplainPrompt,
  buildOperationsPlanPrompt,
};
