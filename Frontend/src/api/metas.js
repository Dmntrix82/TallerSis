import { apiFetch } from './client.js'

// TDSI-58/774: meta, vendido y % de avance por caja para la fecha pedida (por defecto
// hoy). Cada fila: { caja_id, caja_nombre, fecha, vendido, meta: numero|'sin meta',
// porcentaje: numero|'sin meta' }.
export function obtenerAvanceMetas(fecha) {
  const params = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
  return apiFetch(`/api/metas${params}`)
}

// TDSI-58/773: fija (o cambia) la meta de venta diaria de una caja; el monto debe ser > 0.
export function definirMeta(cajaId, { monto, actualizado_por }) {
  return apiFetch(`/api/metas/${encodeURIComponent(cajaId)}`, {
    method: 'PUT',
    body: JSON.stringify({ monto, actualizado_por }),
  })
}
