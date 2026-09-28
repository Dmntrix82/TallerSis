import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/facturacion (TDSI-95/303/304/305/306).
const FACTURACION_API_BASE_URL = import.meta.env.VITE_FACTURACION_API_BASE_URL ?? ''

export function listarFacturas() {
  return apiFetch('/api/facturas', {}, FACTURACION_API_BASE_URL)
}

export function solicitarAnulacion({ factura_numero, motivo, solicitado_por }) {
  return apiFetch(
    '/anulaciones',
    {
      method: 'POST',
      body: JSON.stringify({ factura_numero, motivo, solicitado_por }),
    },
    FACTURACION_API_BASE_URL,
  )
}

// TDSI-384/385: el supervisor aprueba o rechaza con su usuario + PIN, en el momento.
export function autorizarAnulacion(anulacionId, { supervisor_id, pin, decision, observacion }) {
  return apiFetch(
    `/anulaciones/${anulacionId}/autorizar`,
    {
      method: 'POST',
      body: JSON.stringify({ supervisor_id, pin, decision, observacion }),
    },
    FACTURACION_API_BASE_URL,
  )
}
