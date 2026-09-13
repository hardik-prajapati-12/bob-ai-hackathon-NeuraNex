import apiClient from './client';

export const getVessels = (params = {}) =>
  apiClient.get('/vessels', { params }).then((r) => r.data);

export const getVesselById = (id) =>
  apiClient.get(`/vessels/${id}`).then((r) => r.data);

export const getAtRiskVessels = () =>
  apiClient.get('/vessels/at-risk').then((r) => r.data);

export const getVesselStats = () =>
  apiClient.get('/vessels/stats').then((r) => r.data);
