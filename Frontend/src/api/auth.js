import { apiFetch } from './client.js'

// =========================================================================
// Auth del Sistema Cliente (TDSI-11) — microservicio gestion_pagos (4005)
// =========================================================================
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

// =========================================================================
// Auth del cajero (TDSI-1) — microservicio gestion_caja (4004)
// =========================================================================
const GESTION_CAJA_API_BASE_URL = import.meta.env.VITE_GESTION_CAJA_API_BASE_URL ?? ''

export function loginCajero({ email, password, caja_id }) {
  return apiFetch(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, caja_id }),
    },
    GESTION_CAJA_API_BASE_URL,
  )
}