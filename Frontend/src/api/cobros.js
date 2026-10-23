import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-29/549: cuanto vuelto hay que entregar, calculado por el backend
// (nunca confiamos en un calculo hecho solo en el navegador).
export function calcularVuelto(total, monto_recibido) {
  return apiFetch(
    '/api/cobros/efectivo/calcular-vuelto',
    {
      method: 'POST',
      body: JSON.stringify({ total, monto_recibido }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-39/155: URL de la imagen fija del QR de la cuenta del negocio (la misma para todos los cobros).
export function urlQrCuenta() {
  return `${GESTION_PAGOS_API_BASE_URL}/api/cobros/qr-cuenta.png`
}

// TDSI-39/531: crea el cobro pendiente que se muestra junto al QR fijo de la cuenta.
export function crearCobroQr({ monto, caja_id, cajero }) {
  return apiFetch(
    '/api/cobros/qr',
    {
      method: 'POST',
      body: JSON.stringify({ monto, caja_id, cajero }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-39/532: consulta periodica mientras se espera la confirmacion del pago.
export function consultarEstadoCobroQr(id) {
  return apiFetch(`/api/cobros/qr/${encodeURIComponent(id)}/estado`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-39/533: el cajero confirma a mano que vio llegar el deposito.
export function confirmarCobroQr(id, confirmado_por) {
  return apiFetch(
    `/api/cobros/qr/${encodeURIComponent(id)}/confirmar`,
    {
      method: 'POST',
      body: JSON.stringify({ confirmado_por }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}
