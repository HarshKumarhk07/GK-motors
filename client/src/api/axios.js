import axios from 'axios';

/**
 * Resolve the API base URL.
 *
 * A template literal around an unset import.meta.env value yields the *string*
 * "undefined", which silently turns every request into /undefined/auth/login.
 * Guard against that and fall back to '/api', which the Vite dev server proxies
 * to localhost:5000 (see vite.config.js).
 *
 * Set VITE_API_URL in client/.env to point at a different backend. In local
 * development prefer the absolute form — http://localhost:5000/api — because
 * the admin live-tracking socket derives its host by stripping /api from this
 * value and needs a real origin to connect to.
 */
const rawBase = import.meta.env.VITE_API_URL;
const hasBase =
  typeof rawBase === 'string' && rawBase.trim() !== '' && rawBase.trim() !== 'undefined';

export const API_BASE_URL = hasBase ? rawBase.trim().replace(/\/+$/, '') : '/api';

if (!hasBase && import.meta.env.DEV) {
  console.warn(
    '[api] VITE_API_URL is not set — falling back to "%s" via the Vite dev proxy.\n' +
      '      Create client/.env with VITE_API_URL=http://localhost:5000/api and restart the dev server.',
    API_BASE_URL
  );
}

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach JWT
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('bikeservice_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bikeservice_token');
      localStorage.removeItem('bikeservice_user');
      // Carry the page they were on so login can send them back. The service
      // cart lives in its own localStorage key and is deliberately preserved.
      const here = window.location.pathname + window.location.search;
      const target = here && here !== '/login'
        ? `/login?redirect=${encodeURIComponent(here)}`
        : '/login';
      if (window.location.pathname !== '/login') window.location.href = target;
    }
    return Promise.reject(error);
  }
);

export default API;
