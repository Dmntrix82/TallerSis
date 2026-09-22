const { AppError } = require("../utils/AppError");
const { clientesFrecuentes } = require("../data/memoria");

/**
 * TDSI-288: busca un cliente frecuente por NIT exacto.
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
 */
function sugerirClientes(query = "", limite = 10) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];
  return clientesFrecuentes
    .filter((c) => c.nit.includes(q) || c.razon_social.toLowerCase().includes(q))
    .slice(0, limite);
}

/**
 * TDSI-289: guarda/actualiza un cliente (upsert).
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

/**
 * TDSI-289: guarda un cliente nuevo la primera vez que factura.
 * Si ya existe, NO sobreescribe.
 * @returns {{ creado: boolean, cliente: object|null }}
 */
function guardarSiNoExiste({ nit, razon_social, email } = {}) {
  if (!nit || !razon_social) {
    return { creado: false, cliente: null };
  }
  const existente = clientesFrecuentes.find((c) => c.nit === nit);
  if (existente) return { creado: false, cliente: existente };

  const nuevo = { nit, razon_social, email: email ?? null };
  clientesFrecuentes.push(nuevo);
  return { creado: true, cliente: nuevo };
}

module.exports = {
  buscarClientePorNit,
  sugerirClientes,
  guardarCliente,
  guardarSiNoExiste,
};
