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

// TDSI-57/763: ventas por hora del dia (07:00-23:00, hora de Bolivia) en un rango de
// fechas, con filtro opcional por caja. "horas" solo trae las horas que tuvieron
// ventas -- el Front completa las horas sin ventas en 0. Responde { horas: [{hora,
// cantidad, monto}], top3: [...] } (top3 = las 3 horas con mas ventas, mismo shape).
export function obtenerHorasPico(desde, hasta, caja) {
  const params = new URLSearchParams({ desde, hasta })
  if (caja) params.set('caja', caja)
  return apiFetch(`/api/tablero/horas-pico?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-56/737: total del mes elegido vs. el mes anterior (mismos dias si el mes elegido
// es el actual), desglosado por caja y por metodo de pago, con la variacion en %.
// Responde { mes, anio, mesAnterior, anioAnterior, comparadoPorMismosDias,
// total: {actual, anterior, variacion}, porCaja: [...], porMetodo: [...] }.
// "variacion" es null cuando el mes anterior fue 0 y el actual no (no hay con que comparar).
export function obtenerComparativoMensual(mes, anio) {
  const params = new URLSearchParams({ mes, anio })
  return apiFetch(`/api/tablero/comparativo-mensual?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}
