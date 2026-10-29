import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Where the dev server sends API, stream and media requests, so the browser
 * sees one origin. The backend's own default port (server, PORT=8787).
 */
const backend = process.env.BACKEND_URL ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/events': backend,
      '/media': backend,
    },
  },
})
