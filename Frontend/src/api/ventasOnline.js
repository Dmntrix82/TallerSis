import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-51/686: listado real de ventas del Marketplace, con filtros opcionales por
// rango de fechas (YYYY-MM-DD) y estado (Pagado | Anulacion Pendiente | Anulado).
// Cada venta trae numero_factura, aviso_marketplace_estado (Enviado | Error | null)
// y el detalle de items.
export function listarVentasOnline({ desde, hasta, estado } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  if (estado) params.set('estado', estado)
  const qs = params.toString()
  return apiFetch(`/api/pagos/online/ventas${qs ? `?${qs}` : ''}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-51: boton "Enviar a Marketplace" del modal "Ver factura" -- reenvia el aviso
// Pub/Sub de esa factura, para demostrar la integracion sin esperar una orden nueva.
export function reenviarAvisoMarketplace(id) {
  return apiFetch(`/api/pagos/online/${encodeURIComponent(id)}/reenviar-marketplace`, { method: 'POST' }, GESTION_PAGOS_API_BASE_URL)
}
