import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://your-backend.railway.app';

const api = axios.create({ baseURL: API_URL });

// Injecte automatiquement le token JWT dans chaque requête
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (username: string, password: string) =>
    api.post<{ token: string }>('/api/auth/login', { username, password }),
};

export const clientsAPI = {
  list: () => api.get('/api/clients'),
  detail: (id: string) => api.get(`/api/clients/${id}`),
  create: (phone: string, name?: string) =>
    api.post('/api/clients', { phone, name }),
};

export const shipmentsAPI = {
  parse: (phone: string, rawMessage: string, name?: string) =>
    api.post('/api/shipments/parse', { phone, name, rawMessage }),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/shipments/${id}/status`, { status }),
};

export default api;
