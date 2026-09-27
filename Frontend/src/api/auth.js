import { apiFetch } from './client.js'

export function generarToken({ clientId, clientSecret }) {
  return apiFetch('/auth/token', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
}

export function verificarToken(accessToken) {
  return apiFetch('/auth/verificar', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
