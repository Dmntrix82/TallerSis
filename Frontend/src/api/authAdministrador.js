import { apiFetch } from './client.js'

// Login de administrador: mismo microservicio gestion_caja, endpoint distinto al del cajero.
const GESTION_CAJA_API_BASE_URL = import.meta.env.VITE_GESTION_CAJA_API_BASE_URL ?? ''

export function loginAdministrador({ email, password }) {
  return apiFetch(
    '/api/auth/login-administrador',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    GESTION_CAJA_API_BASE_URL,
  )
}
