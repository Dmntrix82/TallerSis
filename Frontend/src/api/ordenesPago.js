import { apiFetch } from './client.js'

// Microservicio pagos_proveedores (puerto 4006). Por defecto usa el proxy de Vite
// (/api/proveedores); VITE_PROVEEDORES_API_BASE_URL solo hace falta si se despliega aparte.
const PROVEEDORES_API_BASE_URL = import.meta.env.VITE_PROVEEDORES_API_BASE_URL ?? ''

// Ordenes de pago pendientes recibidas de Compras
export function obtenerOrdenesPendientes() {
  return apiFetch('/api/proveedores/ordenes/pendientes', {}, PROVEEDORES_API_BASE_URL)
}
