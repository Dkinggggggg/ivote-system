import axios from 'axios';

const defaultApiBaseUrl = '/api';

// Keep API requests on the app origin; Vite proxies them to Laravel in development.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ivote_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ivote_token');
      localStorage.removeItem('ivote_user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default apiClient;
