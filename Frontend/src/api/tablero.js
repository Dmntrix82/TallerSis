import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos (TDSI-111/375/376/377/378/381).
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

export function obtenerIngresosDia(fecha) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  return apiFetch(`/api/tablero/ingresos-dia${query}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-330: rankings (que caja/cajero/cliente generan mas), historico completo.
export function obtenerRankings() {
  return apiFetch('/api/tablero/rankings', {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-331: serie de los ultimos N dias (incluye dias en 0), para el grafico de montañas.
export function obtenerSerieDiaria(dias = 14) {
  return apiFetch(`/api/tablero/serie-diaria?dias=${dias}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-378: URL del stream de Server-Sent Events para actualizar el tablero en vivo.
export function urlStreamIngresosDia() {
  return `${GESTION_PAGOS_API_BASE_URL}/api/tablero/ingresos-dia/stream`
}
