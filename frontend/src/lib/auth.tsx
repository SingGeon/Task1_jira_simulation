import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, getRefreshToken, getToken, setRefreshToken, setToken, setUnauthorizedHandler } from './api';
import { disconnectRealtime } from './realtime';
import type { AuthResponse, User } from './types';
import { SystemRole } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {});
    clearTokens();
    setUser(null);
    disconnectRealtime();
  };

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<User>('/users/me')
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    setToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { email, password, fullName });
    setToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
  };

  const refreshMe = async () => {
    const me = await api.get<User>('/users/me');
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin: user?.systemRole === SystemRole.ADMIN, login, register, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
