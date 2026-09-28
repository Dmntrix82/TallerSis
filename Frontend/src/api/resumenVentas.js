import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos (TDSI-101/327/328/329/330/333).
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

export function obtenerResumenVentas(turnoId, { desde, hasta } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const query = params.toString() ? `?${params.toString()}` : ''

  return apiFetch(`/api/pagos/resumen-turno/${turnoId}${query}`, {}, GESTION_PAGOS_API_BASE_URL)
}
