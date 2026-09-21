import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy hacia el microservicio de cajeros (Back/servicios/cajeros, puerto 4004)
// para evitar problemas de CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/cajeros': {
        target: 'http://localhost:4004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cajeros/, '/cajeros'),
      },
      '/api/pagos': {
        target: 'http://localhost:4005',
        changeOrigin: true,
      },
    },
  },
})
