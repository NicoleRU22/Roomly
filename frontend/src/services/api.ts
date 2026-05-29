import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar token JWT y X-Tenant-Slug en las cabeceras de cada petición
api.interceptors.request.use((config) => {
  const { token, tenant } = useAuthStore.getState();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenant) {
    config.headers['X-Tenant-Slug'] = tenant.slug;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de respuesta para manejar errores de autorización (ej: token vencido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Forzar logout si el token es inválido/expirado
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
