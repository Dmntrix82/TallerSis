import { apiFetch } from './client.js'

const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-29/549: cuanto vuelto hay que entregar, calculado por el backend
// (nunca confiamos en un calculo hecho solo en el navegador).
export function calcularVuelto(total, monto_recibido) {
  return apiFetch(
    '/api/cobros/efectivo/calcular-vuelto',
    {
      method: 'POST',
      body: JSON.stringify({ total, monto_recibido }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}
