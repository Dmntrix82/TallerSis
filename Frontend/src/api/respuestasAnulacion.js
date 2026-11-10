import { apiFetch } from './client.js'

// TDSI-48: respuestas rapidas de anulacion de cada cajero (microservicio facturacion).
// Es una lista aparte de las respuestas de "Cancelar venta" (TDSI-44).
// Cada respuesta es { id, cajero_id, texto, orden, creado_en }.
const FACTURACION_API_BASE_URL = import.meta.env.VITE_FACTURACION_API_BASE_URL ?? ''
const BASE = '/api/facturas/respuestas-anulacion'

// Reglas del ticket (tambien aplicadas por el backend: 10 a 100 caracteres y maximo 8 por cajero).
export const MAXIMO_RESPUESTAS_ANULACION = 8
export const LARGO_MINIMO_ANULACION = 10 // Contabilidad rechaza motivos mas cortos
export const LARGO_MAXIMO_ANULACION = 100

// TDSI-890
export function listarRespuestasAnulacion(cajero_id) {
  return apiFetch(`${BASE}?${new URLSearchParams({ cajero_id })}`, {}, FACTURACION_API_BASE_URL)
}

// TDSI-891
export function crearRespuestaAnulacion({ cajero_id, texto, orden }) {
  return apiFetch(
    BASE,
    { method: 'POST', body: JSON.stringify({ cajero_id, texto, orden }) },
    FACTURACION_API_BASE_URL,
  )
}

// TDSI-891
export function editarRespuestaAnulacion(id, { cajero_id, texto }) {
  return apiFetch(
    `${BASE}/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify({ cajero_id, texto }) },
    FACTURACION_API_BASE_URL,
  )
}

// TDSI-892
export function eliminarRespuestaAnulacion(id, cajero_id) {
  return apiFetch(
    `${BASE}/${encodeURIComponent(id)}?${new URLSearchParams({ cajero_id })}`,
    { method: 'DELETE' },
    FACTURACION_API_BASE_URL,
  )
}

// Sirve para las respuestas guardadas y para el motivo escrito a mano (minimo 10 caracteres).
export function validarMotivoAnulacion(texto) {
  const largo = texto.trim().length
  if (largo < LARGO_MINIMO_ANULACION) return `El motivo debe tener al menos ${LARGO_MINIMO_ANULACION} caracteres.`
  if (largo > LARGO_MAXIMO_ANULACION) return `El motivo puede tener hasta ${LARGO_MAXIMO_ANULACION} caracteres.`
  return null
}
