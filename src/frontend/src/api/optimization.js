import apiClient from './client';

export const getBerthRecommendations = (vesselIds) =>
  apiClient.post('/optimization/berths', { vesselIds }).then((r) => r.data);

export const getCraneRecommendations = () =>
  apiClient.post('/optimization/cranes').then((r) => r.data);

export const getCurrentVsRecommended = () =>
  apiClient.get('/optimization/current-vs-recommended').then((r) => r.data);
