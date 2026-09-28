import { apiFetch } from './client.js'

export function obtenerFactura(numero) {
  return apiFetch(`/api/facturas/${numero}`)
}

export function obtenerTirillaTexto(numero) {
  // apiFetch parsea JSON por defecto, así que usamos fetch directamente para texto plano
  return fetch(`/api/facturas/${numero}/tirilla`).then(res => res.text())
}

export function imprimirFactura(numero) {
  return apiFetch(`/api/facturas/${numero}/imprimir`, { method: 'POST' })
}

export function reimprimirFactura(numero, motivo = 'Reimpresión solicitada por cajero') {
  return apiFetch(`/api/facturas/${numero}/reimprimir`, { 
    method: 'POST',
    body: JSON.stringify({ motivo })
  })
}
