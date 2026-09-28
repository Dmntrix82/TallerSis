import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_caja.
const GESTION_CAJA_API_BASE_URL = import.meta.env.VITE_GESTION_CAJA_API_BASE_URL ?? ''

export function obtenerTurnoActual(cajaId) {
  return apiFetch(
    `/api/caja/turnos/actual?caja_id=${encodeURIComponent(cajaId)}`,
    {},
    GESTION_CAJA_API_BASE_URL,
  )
}
