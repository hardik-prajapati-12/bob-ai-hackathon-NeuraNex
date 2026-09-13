'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { unauthorized } = require('../utils/apiResponse');

/**
 * Demo authentication middleware.
 *
 * For the hackathon MVP we use simple demo credentials.
 * The JWT structure is in place so production auth can be added later
 * by swapping in real user lookup logic.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Authentication required');
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return unauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Optional auth — attaches user if token present but does not block unauthenticated requests.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      // ignore invalid tokens for optional auth
    }
  }

  next();
}

module.exports = { authenticate, optionalAuth };
