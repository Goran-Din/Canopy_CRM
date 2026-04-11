import { create } from 'zustand';

export interface AuthUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant_id: string;
  roles: Array<{ role: string; division_id: string | null }>;
  customer_id?: string; // Present for portal (client) users
}

interface AuthState {
  accessToken: string | null;
  user: AuthUserInfo | null;
  setAuth: (accessToken: string, user: AuthUserInfo) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
