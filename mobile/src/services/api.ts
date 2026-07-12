import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// EXPO_PUBLIC_API_URL permet de pointer vers un backend local en dev
// (ex: `EXPO_PUBLIC_API_URL=http://localhost:3000 expo start --web`)
// sans modifier app.json, qui reste la config de build de production.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'https://your-backend.railway.app';

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
  clientRegister: (phone: string, password: string, name?: string) =>
    api.post<{ token: string; client: any }>('/api/auth/client/register', { phone, password, name }),
  clientLogin: (phone: string, password: string) =>
    api.post<{ token: string; client: any }>('/api/auth/client/login', { phone, password }),
  clientForgotPassword: (phone: string, name: string, newPassword: string) =>
    api.post('/api/auth/client/forgot-password', { phone, name, newPassword }),
  gestionnaireLogin: (username: string, password: string) =>
    api.post<{ token: string; gestionnaire: any }>('/api/auth/gestionnaire/login', { username, password }),
};

export const clientsAPI = {
  list: () => api.get('/api/clients'),
  overview: () => api.get('/api/clients/overview'),
  workflowState: () => api.get('/api/clients/workflow-state'),
  updateWorkflowState: (payload: {
    isTransitStarted: boolean;
    activePhase: 'loading' | 'atSea' | 'distribution';
    departureDate: string | null;
  }) => api.put('/api/clients/workflow-state', payload),
  detail: (id: string) => api.get(`/api/clients/${id}`),
  create: (phone: string, name?: string) =>
    api.post('/api/clients', { phone, name }),
  subscribers: () => api.get('/api/clients/subscribers'),
  subscriptionStatus: () => api.get('/api/clients/subscription-status'),
  subscribe: (payload: {
    nom: string;
    prenom: string;
    street: string;
    postalCode: string;
    city: string;
    accepted: boolean;
  }) => api.post('/api/clients/subscribe', payload),
  updateSubscription: (id: string, isSubscribed: boolean) =>
    api.patch(`/api/clients/${id}/subscription`, { isSubscribed }),
  remove: (id: string) => api.delete(`/api/clients/${id}`),
};

export const shipmentsAPI = {
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/shipments/${id}/status`, { status }),
  clientOrders: () => api.get('/api/shipments/client-orders'),
  distributionList: () => api.get('/api/shipments/distribution'),
  updateDistributionStatus: (id: string, status: string) =>
    api.patch(`/api/shipments/${id}/distribution-status`, { status }),
  updateVerifiedProducts: (id: string, verifiedProducts: boolean[]) =>
    api.patch(`/api/shipments/${id}/verified-products`, { verifiedProducts }),
  closeBatch: () => api.post('/api/shipments/close-batch'),
  closeLoading: () => api.post('/api/shipments/close-loading'),
  shippedHistory: () => api.get('/api/shipments/shipped-history'),
  batches: () => api.get('/api/shipments/batches'),
};

export type SizeCategory =
  | 'XL'
  | 'XXL'
  | 'VOLUMETRIC_1M3'
  | 'BULK_1000_1999'
  | 'BULK_2000_2999'
  | 'BULK_3000_PLUS';

export type CreateOrderPayload = {
  weightKg: number;
  sizeCategory: SizeCategory;
  contentDescription: string;
  pickupAddress: string;
  deliveryAddress: string;
};

export const ordersAPI = {
  create: (payload: CreateOrderPayload) => api.post('/api/orders', payload),
  mine: () => api.get('/api/orders/mine'),
};

export const messagesAPI = {
  inbox: () => api.get('/api/messages'),
  list: (shipmentId: string) => api.get(`/api/messages/${shipmentId}`),
  send: (shipmentId: string, text: string) => api.post(`/api/messages/${shipmentId}`, { text }),
};

export const disputesAPI = {
  list: () => api.get('/api/disputes'),
  create: (shipmentId: string, type: 'LOST' | 'NON_CONFORME' | 'AUTRE', description?: string) =>
    api.post('/api/disputes', { shipmentId, type, description }),
  update: (id: string, payload: { status?: string; resolution?: string }) =>
    api.patch(`/api/disputes/${id}`, payload),
};

export const financeAPI = {
  overview: () => api.get('/api/finance/overview'),
  addTransaction: (payload: {
    amount: number;
    commissionAmount?: number;
    type: 'COLLECTE' | 'COMMISSION' | 'REVERSEMENT';
    shipmentId?: string;
    notes?: string;
  }) => api.post('/api/finance/transactions', payload),
};

export const notificationsAPI = {
  list: () => api.get('/api/notifications'),
  markRead: (id: string) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
};

export const announcementsAPI = {
  list: () => api.get('/api/announcements'),
  create: (title: string, body: string) => api.post('/api/announcements', { title, body }),
};

export const clientNotificationsAPI = {
  summary: () => api.get('/api/client-notifications'),
  markAnnouncementsSeen: () => api.patch('/api/client-notifications/mark-announcements-seen'),
};

export type PriceSizeTier = {
  label: string;
  maxSpanCm: number;
  maxWeightKg: number;
  priceEur: number;
  bulkMinCartons: number;
  bulkDiscountEur: number;
};
export type PriceBulkTier = { minWeightKg: number; pricePerKg: number };
export type PriceVolumetricBracket = { minVolumeM3: number; maxWeightKg: number; priceEur: number };
export type PricingConfig = {
  sizeTiers: PriceSizeTier[];
  bulkKgTiers: PriceBulkTier[];
  volumetricBracket: PriceVolumetricBracket;
};

export const pricingAPI = {
  get: () => api.get<PricingConfig>('/api/pricing'),
  update: (config: PricingConfig) => api.put<PricingConfig>('/api/pricing', { config }),
};

export default api;
