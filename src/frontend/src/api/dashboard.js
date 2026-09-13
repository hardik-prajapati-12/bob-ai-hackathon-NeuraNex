import apiClient from './client';

export const getDashboardSummary = () =>
  apiClient.get('/dashboard/summary').then((r) => r.data);

export const getDashboardCharts = () =>
  apiClient.get('/dashboard/charts').then((r) => r.data);
