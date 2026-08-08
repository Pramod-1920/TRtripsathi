import axios, { AxiosHeaders } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

// The deployed Admin origin is allowed directly by the backend. During local
// development, use Next.js as a same-origin proxy because the remote backend
// intentionally does not include localhost in its CORS allowlist.
const isLocalBrowser =
  typeof window !== 'undefined'
  && (window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1');
const API_REQUEST_BASE_URL = isLocalBrowser ? '/backend-api' : API_BASE_URL;

// Create axios instance with default config
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_REQUEST_BASE_URL,
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
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const requestUrl = (originalRequest?.url || '').toString();
    const isAuthEndpoint =
      requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/signup')
      || requestUrl.includes('/auth/refresh')
      || requestUrl.includes('/auth/logout');

    if (
      error.response?.status === 401
      && originalRequest
      && !originalRequest._retry
      && !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const csrf = getCookieValue('csrf_token');
        await axios.post(
          `${API_REQUEST_BASE_URL}/auth/refresh`,
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
          window.location.replace('/login');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
