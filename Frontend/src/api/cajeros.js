import { apiFetch } from './client.js'

export function getCajerosStatus() {
  return apiFetch('/cajeros')
}
