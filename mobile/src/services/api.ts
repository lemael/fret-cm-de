import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://your-backend.railway.app';

const api = axios.create({ baseURL: API_URL });

const getStoredToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem('jwt_token') ?? null;
  }
  return SecureStore.getItemAsync('jwt_token');
};

// Injecte automatiquement le token JWT dans chaque requête
api.interceptors.request.use(async (config) => {
  try {
    const token = await getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Sur certaines plateformes web, SecureStore peut échouer.
    // On laisse la requête continuer sans token.
  }
  return config;
});

export const authAPI = {
  login: (username: string, password: string) =>
    api.post<{ token: string }>('/api/auth/login', { username, password }),
  resetPassword: (username: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { username, newPassword }),
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
