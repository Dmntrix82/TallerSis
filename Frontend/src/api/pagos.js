import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

export function registrarPago(pago) {
  return apiFetch(
    '/api/pagos/registrar',
    {
      method: 'POST',
      body: JSON.stringify(pago),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// Extension de TDSI-107/108: en vez de un documento PDF/XML guardado, se construye la
// factura como datos estructurados y se envia (o se simula el envio) al correo indicado.
export function enviarFacturaPorCorreo(id_transaccion, email) {
  return apiFetch(
    `/api/pagos/${encodeURIComponent(id_transaccion)}/enviar-factura`,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

export function calcularPagoMixto(payload) {
  return apiFetch(
    '/api/pagos/mixto/calcular',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    PAGOS_API_BASE_URL,
  )
}

export function registrarPagoMixto(payload) {
  return apiFetch(
    '/api/pagos/mixto',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    PAGOS_API_BASE_URL,
  )
}