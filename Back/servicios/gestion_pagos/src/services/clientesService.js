const { AppError } = require("../utils/AppError");
const { clientesFrecuentes } = require("../data/memoria");

/**
 * TDSI-288: busca un cliente frecuente por NIT exacto.
 * Devuelve la Razón Social para autocompletado.
 * @param {string} nit
 * @returns {{ nit: string, razon_social: string, email?: string }}
 * @throws {AppError} 400 si el NIT es inválido, 404 si no existe
 */
function buscarClientePorNit(nit) {
  if (!nit || typeof nit !== "string") {
    throw new AppError("El NIT es obligatorio y debe ser texto", 400);
  }

  const nitLimpio = nit.trim();

  if (!/^\d{6,15}$/.test(nitLimpio)) {
    throw new AppError("El NIT debe tener entre 6 y 15 dígitos numéricos", 400, {
      nit: nitLimpio,
    });
  }

  const cliente = clientesFrecuentes.find((c) => c.nit === nitLimpio);

  if (!cliente) {
    throw new AppError("Cliente no encontrado", 404, { nit: nitLimpio });
  }

  return cliente;
}

/**
 * TDSI-290: sugerencias para autocompletado.
 * Busca coincidencias parciales por NIT o razón social.
 * @param {string} query
 * @param {number} limite
 */
function sugerirClientes(query = "", limite = 10) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];

  return clientesFrecuentes
    .filter(
      (c) =>
        c.nit.includes(q) ||
        c.razon_social.toLowerCase().includes(q)
    )
    .slice(0, limite);
}

/**
 * TDSI-289 (futuro): guarda un cliente si no existe (upsert en memoria).
 * @param {{ nit: string, razon_social: string, email?: string }} cliente
 */
function guardarCliente({ nit, razon_social, email } = {}) {
  if (!nit || !razon_social) {
    throw new AppError("Los campos 'nit' y 'razon_social' son obligatorios", 400);
  }

  const existente = clientesFrecuentes.find((c) => c.nit === nit);

  if (existente) {
    existente.razon_social = razon_social;
    if (email) existente.email = email;
    return existente;
  }

  const nuevo = { nit, razon_social, email: email ?? null };
  clientesFrecuentes.push(nuevo);
  return nuevo;
}

module.exports = { buscarClientePorNit, sugerirClientes, guardarCliente };