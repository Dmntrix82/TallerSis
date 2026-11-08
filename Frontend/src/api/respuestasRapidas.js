import { apiFetch } from './client.js'

// TDSI-44: respuestas rapidas de cada cajero (microservicio gestion_pagos).
// Cada respuesta es { id, cajero_id, texto, orden, creado_en }.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''
const BASE = '/api/pagos/respuestas-rapidas'

// La regla del ticket que el backend no controla: como maximo 8 por cajero.
export const MAXIMO_RESPUESTAS = 8
export const LARGO_MINIMO = 5
export const LARGO_MAXIMO = 100

// TDSI-799
export function listarRespuestasRapidas(cajero_id) {
  return apiFetch(`${BASE}?${new URLSearchParams({ cajero_id })}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-800
export function crearRespuestaRapida({ cajero_id, texto, orden }) {
  return apiFetch(
    BASE,
    { method: 'POST', body: JSON.stringify({ cajero_id, texto, orden }) },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-800
export function editarRespuestaRapida(id, { cajero_id, texto }) {
  return apiFetch(
    `${BASE}/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify({ cajero_id, texto }) },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-801
export function eliminarRespuestaRapida(id, cajero_id) {
  return apiFetch(
    `${BASE}/${encodeURIComponent(id)}?${new URLSearchParams({ cajero_id })}`,
    { method: 'DELETE' },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// Mismas reglas que el backend (5 a 100 caracteres, sin contar espacios de los extremos).
export function validarTextoRespuesta(texto) {
  const largo = texto.trim().length
  if (largo < LARGO_MINIMO) return `La respuesta debe tener al menos ${LARGO_MINIMO} caracteres.`
  if (largo > LARGO_MAXIMO) return `La respuesta puede tener hasta ${LARGO_MAXIMO} caracteres.`
  return null
}
