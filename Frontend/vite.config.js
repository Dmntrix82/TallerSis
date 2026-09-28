import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/pagos': {
        target: 'http://localhost:4005',
        changeOrigin: true,
      },
      '/api/facturas': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
      '/api/clientes': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
      '/anulaciones': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4005',
        changeOrigin: true,
      },
      '/api/caja': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
      '/transacciones': {
        target: 'http://localhost:4005',
        changeOrigin: true,
      },
      '/api/egresos': {
        target: 'http://localhost:4006',
        changeOrigin: true,
      },
      '/ordenes-pago': {
        target: 'http://localhost:4006',
        changeOrigin: true,
      },
    },
  },
})