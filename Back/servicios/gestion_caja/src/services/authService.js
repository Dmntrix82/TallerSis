const { AppError } = require("../utils/AppError");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/** TDSI-83: autentica al cajero contra Supabase Auth con email y password */
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

  return {
    cajero_id: datos.user.id,
    email: datos.user.email,
    access_token: datos.access_token,
  };
}

module.exports = { autenticarCajero };
