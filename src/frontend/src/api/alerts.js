import apiClient from './client';

export const getAlerts = (params = {}) =>
  apiClient.get('/alerts', { params }).then((r) => r.data);

export const getAlertById = (id) =>
  apiClient.get(`/alerts/${id}`).then((r) => r.data);

export const acknowledgeAlert = (id, acknowledgedBy = 'Operator') =>
  apiClient.put(`/alerts/${id}/acknowledge`, { acknowledgedBy }).then((r) => r.data);
