const repo = require("../data/clientesRepo");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

const cacheSugerencias = new Map();
const MAX_CACHE = 50;
const invalidarCache = () => cacheSugerencias.clear();

function validarCampos(nit, razon_social) {
  if (!nit || !razon_social) throw err("Los campos 'nit' y 'razon_social' son obligatorios");
  if (nit.length > 30) throw err("El NIT no puede superar 30 caracteres");
  if (razon_social.length > 150) throw err("La razón social no puede superar 150 caracteres");
}

/** TDSI-288/91 */
async function buscarClientePorNit(nit) {
  if (!nit || typeof nit !== "string") throw err("El NIT es obligatorio y debe ser texto");
  const nitLimpio = nit.trim();
  if (!/^\d{6,15}$/.test(nitLimpio))
    throw err("El NIT debe tener entre 6 y 15 dígitos numéricos", 400, { nit: nitLimpio });

  const cliente = await repo.buscarPorNit(nitLimpio);
  if (!cliente) throw err("Cliente no encontrado", 404, { nit: nitLimpio });
  return cliente;
}

/** TDSI-290 */
async function sugerirClientes(query = "", limite = 10) {
  const q = String(query).trim().toLowerCase();
  if (!q) return [];

  const key = `${q}|${limite}`;
  if (cacheSugerencias.has(key)) return cacheSugerencias.get(key);

  const resultados = await repo.sugerir(q, limite);

  if (cacheSugerencias.size >= MAX_CACHE) {
    cacheSugerencias.delete(cacheSugerencias.keys().next().value);
  }
  cacheSugerencias.set(key, resultados);
  return resultados;
}

/** TDSI-89/281 */
async function guardarCliente({ nit, razon_social, email } = {}) {
  nit = nit != null ? String(nit).trim() : nit;
  razon_social = razon_social != null ? String(razon_social).trim() : razon_social;
  validarCampos(nit, razon_social);

  const cliente = await repo.upsert({ nit, razon_social, email });
  invalidarCache();
  return cliente;
}

/** TDSI-289 */
async function guardarSiNoExiste({ nit, razon_social, email } = {}) {
  if (!nit || !razon_social) return { creado: false, cliente: null };
  nit = String(nit).trim();
  razon_social = String(razon_social).trim();
  validarCampos(nit, razon_social);

  const r = await repo.insertarSiNoExiste({ nit, razon_social, email });
  if (r.creado) invalidarCache();
  return r;
}

module.exports = { buscarClientePorNit, sugerirClientes, guardarCliente, guardarSiNoExiste };