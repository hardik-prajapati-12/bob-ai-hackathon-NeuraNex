import apiClient from './client';

export async function login(username, password) {
  const res = await apiClient.post('/auth/login', { username, password });
  return res.data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function getHealth() {
  const res = await apiClient.get('/health');
  return res.data;
}
