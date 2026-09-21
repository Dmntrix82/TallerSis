import { apiFetch } from './client.js'

const PAGOS_API_BASE_URL = import.meta.env.VITE_PAGOS_API_BASE_URL ?? 'http://localhost:4005'

export function registrarPago(pago) {
  return apiFetch(
    '/api/pagos/registrar',
    {
      method: 'POST',
      body: JSON.stringify(pago),
    },
    PAGOS_API_BASE_URL,
  )
}
