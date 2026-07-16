import { create } from 'zustand';

type SessionUser = {
  id: string;
  phoneNumber: string;
  email?: string | null;
  role: 'admin' | 'user';
  profilePhoto?: string | null;
};

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setSession: (user: SessionUser | null) => void;
  setProfilePhoto: (profilePhoto: string | null) => void;
  setAuthenticated: (auth: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: (user) => set({ isAuthenticated: true, isLoading: false, user }),
  logout: () => set({ isAuthenticated: false, isLoading: false, user: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setSession: (user) =>
    set((state) => ({
      isAuthenticated: !!user,
      isLoading: false,
      user: user
        ? {
            ...state.user,
            ...user,
          }
        : null,
    })),
  setProfilePhoto: (profilePhoto) =>
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            profilePhoto,
          }
        : null,
    })),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
}));
