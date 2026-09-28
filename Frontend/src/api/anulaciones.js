import { apiFetch } from './client.js'

export async function listarFacturasPendientesAutorizacion() {
  const respuesta = await apiFetch('/api/facturas')
  return respuesta.data.filter((factura) => factura.estado === 'AnulacionSolicitada')
}

export function autorizarAnulacion(anulacionId, datos) {
  return apiFetch(`/anulaciones/${encodeURIComponent(anulacionId)}/autorizar`, {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}
