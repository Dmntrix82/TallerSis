import { apiFetch } from './client.js'

const PAGOS_API_BASE_URL = import.meta.env.VITE_PAGOS_API_BASE_URL ?? ''

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

export function calcularPagoMixto(payload) {
  return apiFetch(
    '/api/pagos/mixto/calcular',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    PAGOS_API_BASE_URL,
  )
}

export function registrarPagoMixto(payload) {
  return apiFetch(
    '/api/pagos/mixto',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    PAGOS_API_BASE_URL,
  )
}