import apiClient from './client';

export const getCranes = (params = {}) =>
  apiClient.get('/cranes', { params }).then((r) => r.data);

export const getCraneById = (id) =>
  apiClient.get(`/cranes/${id}`).then((r) => r.data);
