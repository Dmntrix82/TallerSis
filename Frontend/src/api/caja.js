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
