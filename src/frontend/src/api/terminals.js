import apiClient from './client';

export const getTerminals = () =>
  apiClient.get('/terminals').then((r) => r.data);

export const getTerminalById = (id) =>
  apiClient.get(`/terminals/${id}`).then((r) => r.data);

export const getTerminalSummary = (id) =>
  apiClient.get(`/terminals/${id}/summary`).then((r) => r.data);
