import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/facturacion (TDSI-89/279/280/281/282).
const FACTURACION_API_BASE_URL = import.meta.env.VITE_FACTURACION_API_BASE_URL ?? ''

export async function sugerirClientes(query, limite = 8) {
  const params = new URLSearchParams({ q: query, limite: String(limite) })
  const respuesta = await apiFetch(`/api/clientes?${params.toString()}`)
  return respuesta.data
}

export async function buscarClientePorNit(nit) {
  const respuesta = await apiFetch(`/api/clientes/${encodeURIComponent(nit)}`)
  return respuesta.data
}

export function guardarCliente({ nit, razon_social }) {
  return apiFetch(
    '/api/clientes',
    {
      method: 'POST',
      body: JSON.stringify({ nit, razon_social }),
    },
    FACTURACION_API_BASE_URL,
  )
}