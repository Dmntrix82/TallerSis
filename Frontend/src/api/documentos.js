import { apiFetch } from './client.js'

// Apunta al microservicio Back/servicios/facturacion (TDSI-107/351/352/353/354/356).
const FACTURACION_API_BASE_URL = import.meta.env.VITE_FACTURACION_API_BASE_URL ?? ''

export function obtenerEstadoDocumentos(numero) {
  return apiFetch(`/api/facturas/${encodeURIComponent(numero)}/documentos`, {}, FACTURACION_API_BASE_URL)
}

// Descarga el PDF/XML directo al navegador. No usa apiFetch porque la respuesta
// es el archivo binario, no JSON.
export async function descargarDocumento(numero, tipo) {
  const url = `${FACTURACION_API_BASE_URL}/api/facturas/${encodeURIComponent(numero)}/documentos/${tipo}`
  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.mensaje ?? `Error ${response.status}: ${response.statusText}`)
  }

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = blobUrl
  enlace.download = `${numero}.${tipo}`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(blobUrl)
}
