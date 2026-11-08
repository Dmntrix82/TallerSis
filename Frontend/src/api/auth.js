import { apiFetch } from './client.js'

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

// TDSI-183: desbloquea la pantalla con la contraseña del cajero de la sesión.
// Al tercer intento fallido el backend cierra la sesión.
export function desbloquearPantalla({ cajero_id, email, password }) {
  return apiFetch(
    '/api/auth/desbloquear',
    {
      method: 'POST',
      body: JSON.stringify({ cajero_id, email, password }),
    },
    GESTION_CAJA_API_BASE_URL,
  )
}
