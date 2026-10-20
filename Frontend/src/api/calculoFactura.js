import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-40/537: dado un detalle de ítems (cantidad x precio unitario) y un
// descuento opcional, el backend calcula subtotal por ítem, IVA (13%) y total.
export function calcularFactura({ items, descuento }) {
  return apiFetch(
    '/api/facturas/calcular',
    {
      method: 'POST',
      body: JSON.stringify({ items, descuento }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}
