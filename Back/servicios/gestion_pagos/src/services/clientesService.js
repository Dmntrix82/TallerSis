const { AppError } = require("../utils/AppError");
const { clientesFrecuentes } = require("../data/memoria");

// =====================================================================
// TDSI-290: índices en memoria para acelerar la búsqueda.
// - indicePorNit: Map<nit, cliente>  → búsqueda exacta O(1)
// - cacheSugerencias: LRU simple     → sugerencias repetidas instantáneas
// =====================================================================

let indicePorNit = new Map();

function reconstruirIndice() {
  indicePorNit = new Map(clientesFrecuentes.map((c) => [c.nit, c]));
}

const cacheSugerencias = new Map();
const MAX_CACHE = 50;

function invalidarCache() {
  cacheSugerencias.clear();
}

// Construir índice al arrancar
reconstruirIndice();

// =====================================================================
// Servicios
// =====================================================================

/**
 * TDSI-288 + TDSI-290: busca un cliente frecuente por NIT exacto.
 * Usa el índice para respuesta O(1).
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

  const cliente = indicePorNit.get(nitLimpio);
  if (!cliente) {
    throw new AppError("Cliente no encontrado", 404, { nit: nitLimpio });
  }
  return cliente;
}

/**
 * TDSI-290: sugerencias para autocompletado, con cache.
 */
function sugerirClientes(query = "", limite = 10) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];

  const key = `${q}|${limite}`;
  if (cacheSugerencias.has(key)) {
    return cacheSugerencias.get(key);
  }

  const resultados = clientesFrecuentes
    .filter((c) => c.nit.includes(q) || c.razon_social.toLowerCase().includes(q))
    .slice(0, limite);

  // LRU: si se llena, elimina la entrada más antigua
  if (cacheSugerencias.size >= MAX_CACHE) {
    const primeraKey = cacheSugerencias.keys().next().value;
    cacheSugerencias.delete(primeraKey);
  }
  cacheSugerencias.set(key, resultados);

  return resultados;
}

/**
 * TDSI-289: guarda/actualiza un cliente (upsert).
 */
function guardarCliente({ nit, razon_social, email } = {}) {
  if (!nit || !razon_social) {
    throw new AppError("Los campos 'nit' y 'razon_social' son obligatorios", 400);
  }
  const existente = indicePorNit.get(nit);
  if (existente) {
    existente.razon_social = razon_social;
    if (email) existente.email = email;
    invalidarCache();
    return existente;
  }
  const nuevo = { nit, razon_social, email: email ?? null };
  clientesFrecuentes.push(nuevo);
  reconstruirIndice();
  invalidarCache();
  return nuevo;
}

/**
 * TDSI-289: guarda un cliente nuevo la primera vez que factura.
 */
function guardarSiNoExiste({ nit, razon_social, email } = {}) {
  if (!nit || !razon_social) {
    return { creado: false, cliente: null };
  }
  const existente = indicePorNit.get(nit);
  if (existente) return { creado: false, cliente: existente };

  const nuevo = { nit, razon_social, email: email ?? null };
  clientesFrecuentes.push(nuevo);
  reconstruirIndice();
  invalidarCache();
  return { creado: true, cliente: nuevo };
}

module.exports = {
  buscarClientePorNit,
  sugerirClientes,
  guardarCliente,
  guardarSiNoExiste,
};
