import { apiFetch } from './client.js'

export async function sugerirClientes(query, limite = 8) {
  const params = new URLSearchParams({ q: query, limite: String(limite) })
  const respuesta = await apiFetch(`/api/clientes?${params.toString()}`)
  return respuesta.data
}

export async function buscarClientePorNit(nit) {
  const respuesta = await apiFetch(`/api/clientes/${encodeURIComponent(nit)}`)
  return respuesta.data
}
