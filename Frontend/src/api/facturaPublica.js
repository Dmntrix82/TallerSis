import { apiFetch } from './client.js'

const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-38/528: endpoint publico (sin login), al que lleva el QR impreso en la factura.
export function verificarFactura(token) {
  return apiFetch(`/api/facturas/verificar/${encodeURIComponent(token)}`, {}, GESTION_PAGOS_API_BASE_URL)
}
