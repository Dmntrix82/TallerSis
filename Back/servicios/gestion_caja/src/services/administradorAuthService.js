const { AppError } = require("../utils/AppError");
const { autenticarCajero } = require("./authService");
const administradoresRepo = require("./../data/administradoresRepo");

/**
 * Login de Administrador: usa el mismo Supabase Auth que el cajero (autenticarCajero
 * ya es generico, solo valida email/password), pero en vez de exigir caja_id y abrir
 * una sesion de terminal, verifica que ese usuario este habilitado como administrador.
 */
async function autenticarAdministrador({ email, password }) {
  const usuario = await autenticarCajero({ email, password });

  const administrador = await administradoresRepo.buscarPorCajeroId(usuario.cajero_id);
  if (!administrador || !administrador.activo) {
    throw new AppError("Este usuario no tiene permisos de administrador.", 403);
  }

  return {
    administrador_id: usuario.cajero_id,
    email: usuario.email,
    nombre: administrador.nombre || usuario.email,
    access_token: usuario.access_token,
  };
}

module.exports = { autenticarAdministrador };
