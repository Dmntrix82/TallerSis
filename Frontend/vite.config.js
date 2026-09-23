import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/cajeros': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
      '/api/pagos': {
        target: 'http://localhost:4005',
        changeOrigin: true,
      },
    },
  },
})