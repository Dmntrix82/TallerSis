import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/gestion_pagos.
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-50/748: filas del libro de ventas del mes elegido + los totales (solo de las validas).
export function obtenerLibroVentas(mes, anio) {
  const params = new URLSearchParams({ mes, anio })
  return apiFetch(`/api/libro-ventas?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-50/749: Excel del libro de ventas, con las mismas filas y totales de la vista previa.
export async function descargarLibroVentasExcel(mes, anio) {
  const base = GESTION_PAGOS_API_BASE_URL
  const params = new URLSearchParams({ mes, anio })
  const response = await fetch(`${base}/api/libro-ventas/excel?${params.toString()}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.mensaje ?? `Error ${response.status}: ${response.statusText}`)
  }
  return response.blob()
}
