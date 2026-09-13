import apiClient from './client';

export const getCongestionCurrent = () =>
  apiClient.get('/congestion/current').then((r) => r.data);

export const getCongestionPredictions = (params = {}) =>
  apiClient.get('/congestion/predictions', { params }).then((r) => r.data);

export const runPrediction = (terminalId, horizon) =>
  apiClient.post('/congestion/predict', { terminalId, horizon }).then((r) => r.data);

export const getCongestionHistory = (params = {}) =>
  apiClient.get('/congestion/history', { params }).then((r) => r.data);
