import { apiFetch } from './client.js'

// Lista de cajas activas, para el selector de "Caja / terminal" del login.
export function listarCajas() {
  return apiFetch('/api/caja/cajas')
}

export function abrirTurno(datos) {
  return apiFetch('/api/caja/turnos/apertura', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function calcularTotalRecaudado(turnoId) {
  return apiFetch(`/api/caja/turnos/${turnoId}/recaudado`)
}

export function generarReporteCierre(turnoId) {
  return apiFetch(`/api/caja/turnos/${turnoId}/cierre/reporte`)
}

// TDSI-325/326: cerrar caja necesita el usuario + PIN de un supervisor de caja
// (ya no se pide el monto contado en efectivo: el cierre se basa en lo registrado).
export function cerrarTurno(turnoId, { supervisor_id, pin } = {}) {
  return apiFetch(`/api/caja/turnos/${turnoId}/cerrar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin }),
  })
}

// TDSI-324: PDF del reporte de cierre (con firma del cajero), para ver/imprimir/guardar.
export function urlReporteCierrePdf(turnoId) {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  return `${base}/api/caja/turnos/${turnoId}/cierre/pdf`
}

// TDSI-126/465: estado de todas las cajas. Cada caja trae { codigo, nombre, estado, activa },
// con estado = ABIERTA | CERRADA | INACTIVA (INACTIVA gana sobre las otras dos).
export function obtenerEstadoCajas() {
  return apiFetch('/api/caja/estado')
}

// TDSI-149/494: reporte de operaciones de una caja en un rango de dias (YYYY-MM-DD, hora de Bolivia).
// caja_id es obligatorio; el rango no puede superar 92 dias. Responde data:
// { caja_id, caja_nombre, desde, hasta, resumen, totales_por_metodo, turnos, diferencias }.
export function obtenerReporteCaja({ caja_id, desde, hasta }) {
  const params = new URLSearchParams({ caja_id, desde, hasta })
  return apiFetch(`/api/caja/reportes?${params.toString()}`)
}

// TDSI-493: el mismo reporte en CSV. Se pide con fetch (y no con un link) para poder mostrar
// el mensaje de error del backend si falla. Devuelve el Blob del archivo.
export async function descargarReporteCajaCsv({ caja_id, desde, hasta }) {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const params = new URLSearchParams({ caja_id, desde, hasta, formato: 'csv' })
  const response = await fetch(`${base}/api/caja/reportes?${params.toString()}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.mensaje ?? `Error ${response.status}: ${response.statusText}`)
  }
  return response.blob()
}
