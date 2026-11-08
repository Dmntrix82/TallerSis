import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-54/702: productos vendidos del dia (solo ventas del Marketplace, que son las
// unicas con desglose por producto) + el estado del envio a Compras de esa fecha.
// Responde { ok, data: { fecha, productos: [{sku, descripcion, cantidad, monto}],
// envio: { estado: Enviado|Error|Recibido, intentos, ultimoError, enviadoEn, recibidoEn } | null } }.
export function obtenerProductosVendidos(fecha) {
  const params = new URLSearchParams({ fecha })
  return apiFetch(`/api/productos-vendidos?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-54/702/718: boton "Enviar a Compras" (una vez por dia, salvo que haya quedado en Error).
export function enviarProductosACompras(fecha) {
  return apiFetch(`/api/productos-vendidos/${encodeURIComponent(fecha)}/enviar-compras`, {
    method: 'POST',
  }, GESTION_PAGOS_API_BASE_URL)
}
