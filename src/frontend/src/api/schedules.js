import apiClient from './client';

export const getSchedules = (params = {}) =>
  apiClient.get('/schedules', { params }).then((r) => r.data);

export const getScheduleById = (id) =>
  apiClient.get(`/schedules/${id}`).then((r) => r.data);

export const getSchedulesByVessel = (vesselId) =>
  apiClient.get(`/schedules/vessel/${vesselId}`).then((r) => r.data);
