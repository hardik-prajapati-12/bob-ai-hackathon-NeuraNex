import apiClient from './client';

export const getBerthRecommendations = (params = {}) =>
  apiClient.get('/optimization/berths', { params }).then((r) => r.data);

export const getCraneRecommendations = (params = {}) =>
  apiClient.get('/optimization/cranes', { params }).then((r) => r.data);

export const getConflicts = (params = {}) =>
  apiClient.get('/optimization/conflicts', { params }).then((r) => r.data);

export const runOptimize = (terminalCode) =>
  apiClient
    .post('/optimization/optimize', terminalCode ? { terminalCode } : {})
    .then((r) => r.data);

export const getStoredRecommendations = (params = {}) =>
  apiClient.get('/optimization/recommendations', { params }).then((r) => r.data);

// Kept for backwards compatibility (Phase 4 frontend used these)
export const getCurrentVsRecommended = (params = {}) =>
  apiClient.get('/optimization/berths', { params }).then((r) => r.data);
