'use strict';

/**
 * Standard API response helpers.
 * All responses follow the shape: { success, data?, message?, errors? }
 */

function success(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function created(res, data, message = 'Created') {
  return success(res, data, message, 201);
}

function error(res, message, statusCode = 500, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function notFound(res, message = 'Resource not found') {
  return error(res, message, 404);
}

function badRequest(res, message = 'Bad request', errors = null) {
  return error(res, message, 400, errors);
}

function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

function paginated(res, data, pagination) {
  return res.status(200).json({
    success: true,
    message: 'OK',
    data,
    pagination,
  });
}

module.exports = { success, created, error, notFound, badRequest, unauthorized, paginated };
