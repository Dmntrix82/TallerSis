import { apiFetch } from './client.js'

export async function listarEgresos() {
  const respuesta = await apiFetch('/api/egresos')
  return respuesta.data.historial
}

export function confirmarPagoOrden(ordenPagoId, usuarioId) {
  return apiFetch(`/ordenes-pago/${encodeURIComponent(ordenPagoId)}/confirmar-pago`, {
    method: 'POST',
    body: JSON.stringify({ usuario_id: usuarioId }),
  })
}
