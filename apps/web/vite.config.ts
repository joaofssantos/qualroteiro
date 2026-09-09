import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * The API origin the dev server proxies `/api` to.
 *
 * In development the browser talks to `/api/...` on the Vite origin and this
 * proxy forwards to the API, so requests stay same-origin and no CORS preflight
 * is involved. `VITE_API_BASE_URL` overrides the target; see `.env.example`.
 */
const DEFAULT_DEV_API_ORIGIN = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env['VITE_API_BASE_URL'] ?? DEFAULT_DEV_API_ORIGIN;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          /*
           * MapLibre is by far the heaviest dependency (~800 kB raw) and it
           * changes far less often than application code. Splitting it out means
           * a returning visitor re-downloads only the app chunk after a deploy,
           * instead of the whole bundle.
           */
          manualChunks: {
            maplibre: ['maplibre-gl'],
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // The API exposes `/routes/plan`, not `/api/routes/plan`.
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
