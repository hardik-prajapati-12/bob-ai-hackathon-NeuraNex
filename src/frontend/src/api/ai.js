import apiClient from './client';

export const sendChatMessage = (message) =>
  apiClient.post('/ai/chat', { message }).then((r) => r.data);

export const explainCongestion = (terminalCode) =>
  apiClient.post('/ai/explain-congestion', { terminalCode }).then((r) => r.data);

export const analyzeItem = (type, id) =>
  apiClient.post('/ai/analyze', { type, id }).then((r) => r.data);

export const getAiStatus = () =>
  apiClient.get('/ai/status').then((r) => r.data);

export const generateOperationsPlan = () =>
  apiClient.post('/ai/operations-plan').then((r) => r.data);

export const generateOperationsPlanAlt = () =>
  apiClient.post('/operations-plan/generate').then((r) => r.data);

export const getOperationsPlans = () =>
  apiClient.get('/operations-plan').then((r) => r.data);

export const getOperationsPlanById = (id) =>
  apiClient.get(`/operations-plan/${id}`).then((r) => r.data);
