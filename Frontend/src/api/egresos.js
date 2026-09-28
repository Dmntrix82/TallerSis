import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/pagos_proveedores (TDSI-399/400/401/402/404).
const PAGOS_PROVEEDORES_API_BASE_URL = import.meta.env.VITE_PAGOS_PROVEEDORES_API_BASE_URL ?? ''

export function obtenerOrdenPago(numero) {
  return apiFetch(`/api/egresos/ordenes/${encodeURIComponent(numero)}`, {}, PAGOS_PROVEEDORES_API_BASE_URL)
}

export function registrarEgreso(egreso) {
  return apiFetch(
    '/api/egresos',
    {
      method: 'POST',
      body: JSON.stringify(egreso),
    },
    PAGOS_PROVEEDORES_API_BASE_URL,
  )
}
