import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const useAuthStore = create<AuthState>((set) => {
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');

  return {
    token: savedToken,
    user: savedUser ? JSON.parse(savedUser) : null,
    isAuthenticated: !!savedToken,

    login: (token: string, user: User) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ token: null, user: null, isAuthenticated: false });
    },

    updateUser: (userData: Partial<User>) => {
      set((state) => {
        const newUser = state.user ? { ...state.user, ...userData } : null;
        if (newUser) {
          localStorage.setItem('user', JSON.stringify(newUser));
        }
        return { user: newUser };
      });
    }
  };
});

export default useAuthStore;
