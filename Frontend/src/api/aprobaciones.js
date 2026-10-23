import { apiFetch } from './client.js'

// TDSI-35 / TDSI-147 / TDSI-478: operaciones de caja que requieren aprobacion del supervisor
// (gestion_caja, puerto 4004).
const BASE = '/api/caja/aprobaciones'

// Catalogo de tipos de operacion: [{ codigo, descripcion }].
export function listarTiposOperacion() {
  return apiFetch(`${BASE}/tipos`)
}

// Bandeja del supervisor, con filtros opcionales por estado (PENDIENTE | APROBADA | RECHAZADA),
// tipo y caja. Responde { total, pendientes, data }; las pendientes vienen primero.
export function listarOperaciones({ estado, tipo, caja_id } = {}) {
  const params = new URLSearchParams()
  if (estado) params.set('estado', estado)
  if (tipo) params.set('tipo', tipo)
  if (caja_id) params.set('caja_id', caja_id)
  const qs = params.toString()
  return apiFetch(`${BASE}${qs ? `?${qs}` : ''}`)
}

// Aprueba con usuario + PIN del supervisor; el motivo es opcional. Responde data: la solicitud resuelta.
export function aprobarOperacion(id, { supervisor_id, pin, motivo }) {
  return apiFetch(`${BASE}/${id}/aprobar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin, motivo }),
  })
}

// Rechaza con usuario + PIN del supervisor y motivo obligatorio. Responde data: la solicitud resuelta.
export function rechazarOperacion(id, { supervisor_id, pin, motivo }) {
  return apiFetch(`${BASE}/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin, motivo }),
  })
}
