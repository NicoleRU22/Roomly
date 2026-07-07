import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
}

interface Tenant {
  id: number;
  slug: string;
  companyName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  login: (token: string, user: User, tenant: Tenant | null) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const safeParse = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error(`Error parsing ${key} from localStorage:`, e);
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  // Inicializar estado desde localStorage si existe
  const savedToken = localStorage.getItem('roomly_token');
  const user = safeParse('roomly_user');
  const tenant = safeParse('roomly_tenant');

  return {
    token: savedToken,
    user,
    tenant,

    login: (token, user, tenant) => {
      localStorage.setItem('roomly_token', token);
      localStorage.setItem('roomly_user', JSON.stringify(user));
      localStorage.setItem('roomly_tenant', JSON.stringify(tenant));
      set({ token, user, tenant });
    },

    updateUser: (partial) => {
      const current = get().user;
      if (!current) return;
      const updated = { ...current, ...partial };
      localStorage.setItem('roomly_user', JSON.stringify(updated));
      set({ user: updated });
    },

    logout: () => {
      localStorage.removeItem('roomly_token');
      localStorage.removeItem('roomly_user');
      localStorage.removeItem('roomly_tenant');
      set({ token: null, user: null, tenant: null });
    },

    isAuthenticated: () => !!get().token,
  };
});
