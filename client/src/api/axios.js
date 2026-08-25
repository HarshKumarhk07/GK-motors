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

/* A cold container plus an Atlas connection can genuinely take longer than a
   warm request, and the landing page's reads are the first thing to hit it. */
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 600;

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

/* A production bundle that was built pointing at localhost cannot work on any
   device but the build machine, and the symptom -- every request hanging until
   it times out -- reads like a slow server rather than a misconfiguration.
   vite.config.js now fails such a build outright; this says the same thing in
   the console for a bundle built before that guard existed. */
if (!import.meta.env.DEV && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(API_BASE_URL)) {
  console.error(
    '[api] This build points at %s, which is the visitor\'s own machine, so every '
    + 'request will hang and time out. Rebuild with VITE_API_URL set to the public '
    + 'API origin.',
    API_BASE_URL
  );
}

// Attach JWT
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('bikeservice_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A page that fires several requests at once (the admin dashboard does) would
// otherwise trigger one redirect per 401. Latch so only the first wins.
let redirecting = false;

/**
 * Should this failure be retried?
 *
 * Only when the request never reached the server -- a timeout or a dropped
 * connection -- and only for methods that are safe to repeat.
 *
 * GET and HEAD only, deliberately. A POST that timed out may well have been
 * received and acted on; retrying one could create a second booking or, far
 * worse, a second payment. Phase 2A went to some length to make a payment
 * happen exactly once, and a blanket retry here would undo that. Anything with
 * a response is left alone too: a 4xx or 5xx is an answer, not a lost request.
 */
const isRetryable = (error) => {
  const method = String(error.config?.method || '').toLowerCase();
  if (method !== 'get' && method !== 'head') return false;
  if (error.response) return false;
  return error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.request?.status;
};

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Handle 401
API.interceptors.response.use(
  (res) => res,
  async (error) => {
    /* Retry idempotent reads before giving up. A first request that wakes a
       sleeping backend can exceed the timeout while the second, against a warm
       server, returns immediately -- which is exactly why a manual reload
       "fixes" it. Doing that automatically saves the customer from having to. */
    const config = error.config;
    if (config && isRetryable(error)) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        await wait(RETRY_BASE_MS * (2 ** (config.__retryCount - 1)));
        return API(config);
      }
    }

    if (error.response?.status === 401 && !redirecting) {
      redirecting = true;
      localStorage.removeItem('bikeservice_token');
      localStorage.removeItem('bikeservice_user');
      // Carry the page they were on so login can send them back. The service
      // cart lives in its own localStorage key and is deliberately preserved.
      const here = window.location.pathname + window.location.search;
      const target = here && here !== '/login'
        ? `/login?redirect=${encodeURIComponent(here)}`
        : '/login';
      if (window.location.pathname !== '/login') {
        window.location.href = target;
      } else {
        redirecting = false;
      }
    }
    return Promise.reject(error);
  }
);

export default API;
