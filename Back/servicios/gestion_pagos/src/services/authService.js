const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const repo = require("../data/sistemasClienteRepo");
const { hashSecret, verificarSecret } = require("../utils/secretHash");
const { AppError } = require("../utils/AppError");
const cfg = require("../config/auth");

// Se usa cuando el client_id no existe, para que la respuesta tarde lo mismo
// y no se pueda adivinar qué client_id son válidos midiendo tiempos.
const HASH_FICTICIO = hashSecret(crypto.randomBytes(32).toString("hex"));

function validarEntrada({ client_id, client_secret } = {}) {
  if (typeof client_id !== "string" || !client_id.trim())
    throw new AppError("El campo 'client_id' es obligatorio y debe ser texto");
  if (typeof client_secret !== "string" || !client_secret)
    throw new AppError("El campo 'client_secret' es obligatorio y debe ser texto");
  if (client_id.trim().length > 60)
    throw new AppError("El 'client_id' no puede superar 60 caracteres");
  if (client_secret.length > 200)
    throw new AppError("El 'client_secret' no puede superar 200 caracteres");
  return { clientId: client_id.trim(), clientSecret: client_secret };
}

/** TDSI-336: validar las credenciales del Sistema Cliente antes de generar el token */
async function validarCredenciales(entrada) {
  const { clientId, clientSecret } = validarEntrada(entrada);

  const sistema = await repo.buscarPorClientId(clientId);
  const secretOk = verificarSecret(
    clientSecret,
    sistema ? sistema.secret_hash : HASH_FICTICIO
  );

  // Mismo mensaje si falla el id o el secreto: no revelamos cuál de los dos está mal
  if (!sistema || !secretOk) throw new AppError("Credenciales inválidas", 401);
  if (!sistema.activo)
    throw new AppError("El Sistema Cliente está deshabilitado", 403);

  return sistema;
}

/** TDSI-335 + TDSI-337: generar el token de acceso con expiración configurable */
async function generarToken(entrada) {
  const sistema = await validarCredenciales(entrada);

  const access_token = jwt.sign(
    { nombre: sistema.nombre, tipo: "sistema_cliente" },
    cfg.JWT_SECRET,
    {
      subject: sistema.client_id,
      expiresIn: cfg.JWT_EXPIRES_IN_SEG,
      issuer: cfg.JWT_ISSUER,
      audience: cfg.JWT_AUDIENCE,
      algorithm: cfg.JWT_ALGORITMO,
    }
  );

  await repo.registrarAcceso(sistema.id);

  return {
    access_token,
    token_type: "Bearer",
    expires_in: cfg.JWT_EXPIRES_IN_SEG,
    expira_en: new Date(
      Date.now() + cfg.JWT_EXPIRES_IN_SEG * 1000
    ).toISOString(),
  };
}

module.exports = { validarCredenciales, generarToken };