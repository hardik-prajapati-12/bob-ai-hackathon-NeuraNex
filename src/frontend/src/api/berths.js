import apiClient from './client';

export const getBerths = (params = {}) =>
  apiClient.get('/berths', { params }).then((r) => r.data);

export const getBerthById = (id) =>
  apiClient.get(`/berths/${id}`).then((r) => r.data);

export const getAvailableBerths = (params = {}) =>
  apiClient.get('/berths/available', { params }).then((r) => r.data);
