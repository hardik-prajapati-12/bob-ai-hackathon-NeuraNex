import apiClient from './client';

export const sendChatMessage = (message, context = {}) =>
  apiClient.post('/ai/chat', { message, context }).then((r) => r.data);

export const explainCongestion = (terminalId) =>
  apiClient.post('/ai/explain-congestion', { terminalId }).then((r) => r.data);

export const generateOperationsPlan = (terminalIds) =>
  apiClient.post('/operations-plan/generate', { terminalIds }).then((r) => r.data);

export const getOperationsPlans = () =>
  apiClient.get('/operations-plan').then((r) => r.data);

export const getOperationsPlanById = (id) =>
  apiClient.get(`/operations-plan/${id}`).then((r) => r.data);
