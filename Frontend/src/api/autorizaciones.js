import { apiFetch } from './client.js'

// TDSI-25 / TDSI-127 / TDSI-470: solicitudes de apertura de caja (gestion_caja, puerto 4004).
// Todavia NO se usa: la bandeja se conecta en otro commit, cuando el backend monte
// autorizacionesRoutes en index.js. Se asume que se montara en /api/caja/autorizaciones.
const BASE = '/api/caja/autorizaciones'

// Bandeja del supervisor: solo trae las solicitudes PENDIENTES.
export function listarSolicitudesPendientes() {
  return apiFetch(`${BASE}/pendientes`)
}

// Aprueba y abre el turno. Responde data: { autorizacion, turno }.
export function aprobarSolicitud(id, { supervisor_id, pin }) {
  return apiFetch(`${BASE}/${id}/aprobar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin }),
  })
}

// Rechaza con motivo obligatorio. Responde data: autorizacion.
export function rechazarSolicitud(id, { supervisor_id, pin, motivo_rechazo }) {
  return apiFetch(`${BASE}/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin, motivo_rechazo }),
  })
}
