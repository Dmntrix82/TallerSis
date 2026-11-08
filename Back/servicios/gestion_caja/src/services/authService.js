const { AppError } = require("../utils/AppError");
const cajerosRepo = require("../data/cajerosRepo");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * TDSI-83: autentica al cajero contra Supabase Auth con email y password.
 * TDSI-47/918: si esa cuenta tiene un perfil en caja.cajeros y esta desactivada,
 * se le niega el login aunque la contrasena sea correcta. Si no tiene perfil ahi
 * (p.ej. un Administrador, que usa esta misma funcion) no se bloquea por esto.
 */
async function autenticarCajero({ email, password }) {
  if (!email || !password) {
    throw new AppError("Los campos email y password son obligatorios.", 400);
  }

  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new AppError("Credenciales invalidas.", 401, datos.error_description || datos.msg || null);
  }

  const cajero = await cajerosRepo.buscarPorCajeroId(datos.user.id);
  if (cajero && !cajero.activo) {
    throw new AppError("Esta cuenta esta desactivada. Contacte al Administrador.", 403);
  }

  return {
    cajero_id: datos.user.id,
    email: datos.user.email,
    access_token: datos.access_token,
  };
}

module.exports = { autenticarCajero };
