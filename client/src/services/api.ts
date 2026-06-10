import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  retries: number = 3,
  delay: number = 1000
): Promise<AxiosResponse<T>> {
  try {
    return await api.request<T>(config);
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return requestWithRetry<T>(config, retries - 1, delay * 2);
    }
    throw error;
  }
}

function shouldRetry(error: any): boolean {
  if (!error.response) {
    return true;
  }
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429;
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default api;
