'use strict';

/**
 * PortMind AI — IBM watsonx.ai Provider
 *
 * Handles:
 *  - IBM IAM token acquisition + caching (refreshes 5 min before expiry)
 *  - Text generation via watsonx.ai REST API
 *  - 401 auto-refresh, 429 rate-limit handling
 *
 * Never logs the API key.
 * All credentials come from config/env.js (loaded from .env).
 */

const https = require('https');
const http = require('http');
const url = require('url');
const config = require('../config/env');
const logger = require('../utils/logger');

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const WATSONX_API_VERSION = '2023-05-29';

// ─── Token Cache ──────────────────────────────────────────────────────────────

let _tokenCache = {
  accessToken: null,
  expiresAt: 0, // epoch ms
};

/**
 * POST to IBM IAM to get a bearer token.
 * Returns { access_token, expires_in }.
 */
async function fetchIAMToken() {
  const body = `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(config.watsonx.apiKey)}`;

  const data = await httpPost(IAM_TOKEN_URL, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  });

  if (!data.access_token) {
    throw new Error('IAM token response missing access_token');
  }
  return data;
}

/**
 * Return a valid cached token, or fetch a new one.
 * Refreshes 5 minutes before expiry.
 */
async function getAccessToken() {
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;

  if (_tokenCache.accessToken && _tokenCache.expiresAt - fiveMin > now) {
    return _tokenCache.accessToken;
  }

  logger.info('watsonx: fetching new IAM token');
  const tokenData = await fetchIAMToken();

  _tokenCache = {
    accessToken: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600) * 1000,
  };

  return _tokenCache.accessToken;
}

/** Invalidate cached token (called on 401). */
function invalidateToken() {
  _tokenCache = { accessToken: null, expiresAt: 0 };
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

/**
 * Simple promise-based HTTP/HTTPS POST.
 * @param {string} targetUrl
 * @param {string|object} body  — string or object (auto-JSON-serialized)
 * @param {object} headers
 * @returns {Promise<object>}  parsed JSON response
 */
function httpPost(targetUrl, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const parsed = url.parse(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path,
      method: 'POST',
      headers: {
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          parsed = { _raw: raw };
        }
        // Attach status code for callers to inspect
        parsed._statusCode = res.statusCode;
        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether watsonx is configured (API key + project ID present).
 */
function isConfigured() {
  return Boolean(config.watsonx.apiKey && config.watsonx.projectId);
}

/**
 * Return configuration status (safe — no credential values).
 */
function getStatus() {
  return {
    configured: isConfigured(),
    modelId: config.watsonx.modelId,
    url: config.watsonx.url,
    projectIdSet: Boolean(config.watsonx.projectId),
    apiKeySet: Boolean(config.watsonx.apiKey),
  };
}

/**
 * Generate text via watsonx.ai.
 *
 * @param {string} prompt  — The full prompt string
 * @param {object} options — Override generation parameters
 * @returns {Promise<string>}  — Generated text
 */
async function generate(prompt, options = {}) {
  if (!isConfigured()) {
    throw new Error('WATSONX_NOT_CONFIGURED');
  }

  const endpoint = `${config.watsonx.url}/ml/v1/text/generation?version=${WATSONX_API_VERSION}`;

  const requestBody = {
    model_id: config.watsonx.modelId,
    project_id: config.watsonx.projectId,
    input: prompt,
    parameters: {
      decoding_method: 'greedy',
      max_new_tokens: options.maxTokens || 800,
      repetition_penalty: options.repetitionPenalty || 1.05,
      stop_sequences: options.stopSequences || [],
    },
  };

  // Attempt with token refresh on 401
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken();

    const response = await httpPost(endpoint, requestBody, {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    });

    if (response._statusCode === 401) {
      invalidateToken();
      if (attempt === 1) throw new Error('watsonx authentication failed after token refresh');
      continue; // retry with fresh token
    }

    if (response._statusCode === 429) {
      throw new Error('WATSONX_RATE_LIMITED');
    }

    if (response._statusCode !== 200) {
      const errMsg = response.errors?.[0]?.message || response.message || `HTTP ${response._statusCode}`;
      throw new Error(`watsonx API error: ${errMsg}`);
    }

    const generatedText = response.results?.[0]?.generated_text;
    if (!generatedText && generatedText !== '') {
      throw new Error('watsonx returned empty results');
    }

    logger.debug('watsonx: generation successful', {
      tokens: response.results?.[0]?.generated_token_count,
      stopReason: response.results?.[0]?.stop_reason,
    });

    return generatedText.trim();
  }
}

module.exports = { generate, isConfigured, getStatus, _invalidateTokenForTest: invalidateToken };
