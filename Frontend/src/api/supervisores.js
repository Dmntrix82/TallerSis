import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/facturacion (dueño del registro de supervisores).
const FACTURACION_API_BASE_URL = import.meta.env.VITE_FACTURACION_API_BASE_URL ?? ''

// TDSI-187: lista de supervisores (nunca incluye el PIN). Cada uno trae
// { id, usuario, nombre, estado: Activo|Inactivo|Bloqueado, activo, bloqueado, bloqueado_hasta, actualizado_en }.
export function listarSupervisores() {
  return apiFetch('/api/supervisores', {}, FACTURACION_API_BASE_URL)
}

// TDSI-721: registra un supervisor nuevo (usuario unico, PIN de 4 a 6 digitos).
export function crearSupervisor({ usuario, nombre, pin }) {
  return apiFetch(
    '/api/supervisores',
    {
      method: 'POST',
      body: JSON.stringify({ usuario, nombre, pin }),
    },
    FACTURACION_API_BASE_URL,
  )
}

// TDSI-722: "Restablecer PIN" -- asigna un PIN nuevo y limpia bloqueo/intentos fallidos.
export function restablecerPinSupervisor(id, pin) {
  return apiFetch(
    `/api/supervisores/${id}/pin`,
    {
      method: 'PUT',
      body: JSON.stringify({ pin }),
    },
    FACTURACION_API_BASE_URL,
  )
}

// TDSI-723: activa o desactiva al supervisor (un supervisor inactivo no puede autorizar nada).
export function cambiarEstadoSupervisor(id, activo) {
  return apiFetch(
    `/api/supervisores/${id}/estado`,
    {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    },
    FACTURACION_API_BASE_URL,
  )
}
