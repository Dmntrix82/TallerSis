import { apiFetch } from './client.js'

// TDSI-47/919: "solo el Administrador gestiona las cuentas" -- estos endpoints exigen
// el access_token de Supabase Auth del administrador logueado (ya viene en el objeto
// "administrador" que guarda AdminAuthContext desde el login, ver administrador.access_token).
function headerAutorizacion(token) {
  return { Authorization: `Bearer ${token}` }
}

// TDSI-47/916: lista unificada de cajeros y supervisores (sin contrasenas ni PIN).
// Cada fila: { id, usuario, nombre, rol: 'Cajero'|'Supervisor', estado: 'Activo'|'Inactivo'|'Bloqueado' }.
export function listarUsuarios(token) {
  return apiFetch('/api/usuarios', { headers: headerAutorizacion(token) })
}

// TDSI-47/171: registra un cajero nuevo (usuario = correo de login, contrasena >= 6 caracteres).
export function crearCajero({ usuario, password, nombre }, token) {
  return apiFetch('/api/usuarios/cajeros', {
    method: 'POST',
    body: JSON.stringify({ usuario, password, nombre }),
    headers: headerAutorizacion(token),
  })
}

// TDSI-47/917: cambia nombre y usuario de un cajero o un supervisor (el id alcanza para distinguirlos).
export function editarUsuario(id, { usuario, nombre }, token) {
  return apiFetch(`/api/usuarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ usuario, nombre }),
    headers: headerAutorizacion(token),
  })
}

// TDSI-47/917: "Cambiar contraseña" -- solo existe para cajeros (login con Supabase Auth).
export function cambiarPasswordCajero(id, password, token) {
  return apiFetch(`/api/usuarios/cajeros/${encodeURIComponent(id)}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
    headers: headerAutorizacion(token),
  })
}

// TDSI-47/918: activa o desactiva un cajero o un supervisor.
export function cambiarEstadoUsuario(id, activo, token) {
  return apiFetch(`/api/usuarios/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
    headers: headerAutorizacion(token),
  })
}
