'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const config = require('../config/env');
const { success, unauthorized, badRequest } = require('../utils/apiResponse');

/**
 * POST /api/auth/login
 * Demo login — validates against configured demo credentials.
 * Returns a JWT for subsequent authenticated requests.
 *
 * In a production system this would look up users in the database.
 */
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  (req, res) => {
    const { username, password } = req.body;

    if (username !== config.demoUsername || password !== config.demoPassword) {
      return unauthorized(res, 'Invalid credentials');
    }

    const payload = {
      userId: 'demo-user',
      username,
      role: 'operations_manager',
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });

    return success(res, {
      token,
      user: {
        username,
        role: payload.role,
        displayName: 'Demo Operations Manager',
      },
    }, 'Login successful');
  }
);

/**
 * POST /api/auth/logout
 * Client-side token invalidation (stateless JWT).
 */
router.post('/logout', (req, res) => {
  return success(res, null, 'Logged out successfully');
});

module.exports = router;
