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
    GESTION_PAGOS_API_BASE_URL,
  )
}

export function registrarPagoMixto(payload) {
  return apiFetch(
    '/api/pagos/mixto',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-303: URL del PDF de la factura (formato tirilla), para verla/imprimirla
// desde el navegador justo despues de registrar el pago.
export function urlFacturaPdf(id_transaccion) {
  return `${GESTION_PAGOS_API_BASE_URL}/api/pagos/${encodeURIComponent(id_transaccion)}/factura.pdf`
}

// TDSI-304: si ese NIT/CI ya se uso en un pago anterior, autocompleta la razon social.
export function buscarClientePorDocumento(tipo_documento, numero) {
  const params = new URLSearchParams({ tipo_documento, numero })
  return apiFetch(`/api/pagos/cliente-por-documento?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-306/307: pantalla "Facturas" del cajero -- solo las ventas que el emitio,
// con filtro opcional de rango de fechas ("YYYY-MM-DD").
export function listarMisFacturas(cajero, { desde, hasta } = {}) {
  const params = new URLSearchParams({ cajero })
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  return apiFetch(`/api/pagos/mis-facturas?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-306: anula una venta propia con el usuario + PIN de un supervisor de caja.
export function anularVenta(id_transaccion, { cajero, supervisor_id, pin }) {
  return apiFetch(
    `/api/pagos/${encodeURIComponent(id_transaccion)}/anular`,
    {
      method: 'POST',
      body: JSON.stringify({ cajero, supervisor_id, pin }),
    },
    GESTION_PAGOS_API_BASE_URL,
  )
}

// TDSI-329: lista de cajeros con al menos una venta, para la pantalla "Cajeros" del administrador.
export function listarCajeros() {
  return apiFetch('/api/pagos/cajeros', {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-327: historial de compras de un cliente (NIT o CI), para la pantalla "Clientes" del administrador.
export function historialCliente(tipo_documento, numero) {
  const params = new URLSearchParams({ tipo_documento, numero })
  return apiFetch(`/api/pagos/historial-cliente?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-328: total ganado por el negocio desde el inicio (todas las cajas), para el tablero.
export function obtenerTotalesGenerales({ desde, hasta } = {}) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  const query = params.toString()
  return apiFetch(`/api/pagos/totales-generales${query ? `?${query}` : ''}`, {}, GESTION_PAGOS_API_BASE_URL)
}