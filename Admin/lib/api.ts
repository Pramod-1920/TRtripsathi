import axios, { AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance with default config
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For cookies
});

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

const attachCsrfHeader = (config: InternalAxiosRequestConfig) => {
  const method = (config.method || '').toString().toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return config;
  const csrf = getCookieValue('csrf_token');
  if (csrf) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set('x-csrf-token', csrf);
    config.headers = headers;
  }
  return config;
};

apiClient.interceptors.request.use((config) => attachCsrfHeader(config));

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const csrf = getCookieValue('csrf_token');
        await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: csrf ? { 'x-csrf-token': csrf } : undefined,
          }
        );

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
