import { apiFetch } from './client.js'

export function obtenerOrdenesPendientes() {
  return apiFetch('/api/pagos/ordenes/pendientes')
}
