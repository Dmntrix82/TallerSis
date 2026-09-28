import { apiFetch } from './client.js'

export function abrirTurno(datos) {
  return apiFetch('/api/caja/turnos/apertura', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function calcularTotalRecaudado(turnoId) {
  return apiFetch(`/api/caja/turnos/${turnoId}/recaudado`)
}

export function generarReporteCierre(turnoId, efectivoContado) {
  let url = `/api/caja/turnos/${turnoId}/cierre/reporte`
  if (efectivoContado != null) {
    url += `?efectivoContado=${efectivoContado}`
  }
  return apiFetch(url)
}

export function cerrarTurno(turnoId, efectivoContado) {
  return apiFetch(`/api/caja/turnos/${turnoId}/cerrar`, {
    method: 'POST',
    body: JSON.stringify({ efectivoContado }),
  })
}
