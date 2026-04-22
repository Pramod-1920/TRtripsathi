import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    phoneNumber: string;
    role: 'admin' | 'user';
  } | null;
  login: (user: AuthState['user']) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSession: (user: AuthState['user'] | null) => void;
  setAuthenticated: (auth: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: (user) => set({ isAuthenticated: true, isLoading: false, user }),
  logout: () => set({ isAuthenticated: false, isLoading: false, user: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setSession: (user) => set({ isAuthenticated: !!user, isLoading: false, user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
}));
