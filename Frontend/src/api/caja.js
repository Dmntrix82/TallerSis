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

// efectivoContado es opcional: si se manda, el reporte incluye el arqueo (esperado vs contado).
export function generarReporteCierre(turnoId, efectivoContado) {
  const params = efectivoContado != null ? `?efectivoContado=${encodeURIComponent(efectivoContado)}` : ''
  return apiFetch(`/api/caja/turnos/${turnoId}/cierre/reporte${params}`)
}

// TDSI-877: Cerrar caja necesita el usuario + PIN de un supervisor de caja.
// Ahora acepta el arreglo `arqueo` (billetes y monedas) para guardarlo en BD.
export function cerrarTurno(turnoId, { supervisor_id, pin, efectivo_contado, arqueo } = {}) {
  return apiFetch(`/api/caja/turnos/${turnoId}/cerrar`, {
    method: 'POST',
    body: JSON.stringify({ supervisor_id, pin, efectivo_contado, arqueo }),
  })
}

// TDSI-324 / TDSI-880: PDF del reporte de cierre (con firma del cajero y detalle de conteo).
export function urlReporteCierrePdf(turnoId, efectivoContado) {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  const params = efectivoContado != null ? `?efectivoContado=${encodeURIComponent(efectivoContado)}` : ''
  return `${base}/api/caja/turnos/${turnoId}/cierre/pdf${params}`
}

// TDSI-126/465: estado de todas las cajas. Cada caja trae { codigo, nombre, estado, activa }
export function obtenerEstadoCajas() {
  return apiFetch('/api/caja/estado')
}

// TDSI-149/494: reporte de operaciones de una caja en un rango de dias (YYYY-MM-DD, hora de Bolivia).
export function obtenerReporteCaja({ caja_id, desde, hasta }) {
  const params = new URLSearchParams({ caja_id, desde, hasta })
  return apiFetch(`/api/caja/reportes?${params.toString()}`)
}

// TDSI-493: el mismo reporte en CSV. Se pide con fetch para interceptar errores.
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

// TDSI-320 / TDSI-878: compara el efectivo o arqueo contado con el esperado del turno (no cierra nada).
// Responde data: { efectivoEsperado, efectivoContado, diferencia, tipoDiferencia, denominaciones? }.
export function compararEfectivo(turnoId, efectivoContado, arqueo) {
  return apiFetch(`/api/caja/turnos/${turnoId}/comparar-efectivo`, {
    method: 'POST',
    body: JSON.stringify(arqueo ? { arqueo } : { efectivoContado }),
  })
}

// TDSI-137/482: total recaudado de cada caja activa en un rango de fechas (por defecto, hoy).
export function obtenerRecaudadoPorCaja({ desde, hasta } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const qs = params.toString()
  return apiFetch(`/api/caja/recaudado${qs ? `?${qs}` : ''}`)
}

// TDSI-139/485: comparacion del monto registrado vs el disponible de los turnos de una fecha.
export function obtenerComparacionMontos({ fecha, caja_id, cajero_id, tipo }) {
  const params = new URLSearchParams({ fecha })
  if (caja_id) params.set('caja_id', caja_id)
  if (cajero_id) params.set('cajero_id', cajero_id)
  if (tipo) params.set('tipo', tipo)
  return apiFetch(`/api/caja/comparacion?${params.toString()}`)
}

// TDSI-141/489: diferencias de caja (faltantes/sobrantes) registradas al cerrar turnos.
export function listarDiferencias({ estado, tipo, caja_id } = {}) {
  const params = new URLSearchParams()
  if (estado) params.set('estado', estado)
  if (tipo) params.set('tipo', tipo)
  if (caja_id) params.set('caja_id', caja_id)
  const qs = params.toString()
  return apiFetch(`/api/caja/diferencias${qs ? `?${qs}` : ''}`)
}

// TDSI-488: resuelve una diferencia; justificacion y resuelta_por son obligatorios.
export function resolverDiferencia(id, { justificacion, resuelta_por }) {
  return apiFetch(`/api/caja/diferencias/${id}/resolver`, {
    method: 'POST',
    body: JSON.stringify({ justificacion, resuelta_por }),
  })
}