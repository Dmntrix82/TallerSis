import { apiFetch } from './client.js'

export function abrirTurno(datos) {
  return apiFetch('/api/caja/turnos/apertura', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}
