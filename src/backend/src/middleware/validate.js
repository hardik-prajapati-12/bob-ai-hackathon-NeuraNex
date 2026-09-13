'use strict';

const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/apiResponse');

/**
 * Runs after express-validator rules.
 * If there are validation errors, returns 400 with error details.
 * Otherwise calls next().
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return badRequest(res, 'Validation failed', errors.array());
  }
  next();
}

module.exports = validate;
