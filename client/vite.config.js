import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Guard: a production build must not bake a localhost API URL into the bundle.
 *
 * Vite inlines `import.meta.env.VITE_API_URL` at BUILD time, so whatever is in
 * client/.env when `npm run build` runs is frozen into the JavaScript every
 * visitor downloads. With `http://localhost:5000/api` in there, every browser
 * that loads the site tries to reach port 5000 on *its own machine* -- which on
 * a phone is the phone. Nothing answers, the request hangs, and axios gives up
 * after its timeout. It looks exactly like a slow or sleeping server, which is
 * what makes it so easy to misdiagnose.
 *
 * The build now fails instead, with the fix in the message. Dev is untouched:
 * localhost is correct there, and the proxy below handles it.
 */
const assertProductionApiUrl = (mode, env) => {
  if (mode !== 'production') return
  const url = (env.VITE_API_URL || '').trim()
  if (!url) return   // empty is fine: src/api/axios.js falls back to same-origin /api
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(url)) {
    throw new Error(
      `\n\nVITE_API_URL is "${url}" for a PRODUCTION build.\n` +
      'That address resolves to the visitor\'s own device, so every API call will\n' +
      'hang and time out. Set it to the public API origin before building, e.g.\n\n' +
      '  VITE_API_URL=https://api.your-domain.com/api\n\n' +
      'or leave it empty to call /api on the same origin and let your host rewrite it.\n'
    )
  }
}

export default defineConfig(({ mode }) => {
  assertProductionApiUrl(mode, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
