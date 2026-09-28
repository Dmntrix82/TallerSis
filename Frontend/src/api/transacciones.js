import { apiFetch } from './client.js'

export function consultarEstadoTransaccion(idTransaccion, accessToken) {
  return apiFetch(`/transacciones/${encodeURIComponent(idTransaccion)}/estado`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
