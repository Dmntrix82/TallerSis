const { AppError } = require("../utils/AppError");
const repo = require("../data/monitoreoRepo");
const { validarFechaDia } = require("../utils/fechaLocal");

const LIMITE_POR_DEFECTO = 5;
const LIMITE_MAXIMO = 20;

function validarTextoOpcional(valor, campo) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.length > 60) throw new AppError(`El campo '${campo}' admite hasta 60 caracteres.`, 400, { [campo]: valor });
  return texto;
}

function validarLimite(valor) {
  if (valor === undefined || valor === null || valor === "") return LIMITE_POR_DEFECTO;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO) {
    throw new AppError(`El 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}.`, 400, { limite: valor });
  }
  return n;
}

/**
 * TDSI-424: ultimas operaciones de cada cajero (del dia), con su estado.
 * Devuelve un elemento por cajero, con sus operaciones de la mas reciente a la mas antigua:
 *   [{ cajero_id, cajero, caja_id, operaciones: [{ id_transaccion, fecha, hora, metodos, monto, tipo_pago, estado, caja_id }] }]
 * caja_id del cajero = la caja de su ultima operacion.
 */
async function listarUltimasOperaciones({ fecha, caja_id, cajero_id, limite } = {}) {
  const filtros = {
    fecha: validarFechaDia(fecha),
    cajaId: validarTextoOpcional(caja_id, "caja_id"),
    cajeroId: validarTextoOpcional(cajero_id, "cajero_id"),
    limite: validarLimite(limite),
  };

  const filas = await repo.ultimasOperacionesPorCajero(filtros);

  const porCajero = new Map();
  for (const f of filas) {
    if (!porCajero.has(f.cajero_id)) {
      porCajero.set(f.cajero_id, { cajero_id: f.cajero_id, cajero: f.cajero, caja_id: f.caja_id, operaciones: [] });
    }
    porCajero.get(f.cajero_id).operaciones.push({
      id_transaccion: f.id_transaccion,
      fecha: f.fecha,
      hora: f.hora,
      metodos: f.metodos,
      monto: f.monto,
      tipo_pago: f.tipo_pago,
      estado: f.estado,
      caja_id: f.caja_id,
    });
  }

  return { fecha: filtros.fecha, filtros: { caja_id: filtros.cajaId, cajero_id: filtros.cajeroId, limite: filtros.limite }, cajeros: [...porCajero.values()] };
}

module.exports = { listarUltimasOperaciones, LIMITE_POR_DEFECTO, LIMITE_MAXIMO };