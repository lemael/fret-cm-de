import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Role = 'admin' | 'client' | 'gestionnaire';

interface AuthContextType {
  token: string | null;
  role: Role | null;
  login: (token: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'jwt_token';
const ROLE_KEY = 'jwt_role';

// Abstraction store : SecureStore sur mobile, localStorage sur web
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([storage.getItem(TOKEN_KEY), storage.getItem(ROLE_KEY)]).then(
      ([storedToken, storedRole]) => {
        if (storedToken) setToken(storedToken);
        if (storedRole) setRole(storedRole as Role);
        setIsLoading(false);
      }
    );
  }, []);

  const login = async (newToken: string, newRole: Role) => {
    await storage.setItem(TOKEN_KEY, newToken);
    await storage.setItem(ROLE_KEY, newRole);
    setToken(newToken);
    setRole(newRole);
  };

  const logout = async () => {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(ROLE_KEY);
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
