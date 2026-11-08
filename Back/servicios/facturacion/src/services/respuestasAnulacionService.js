// En facturacion no existe un AppError custom, usamos el Error nativo con status
const crearError = (mensaje, status) => {
  const e = new Error(mensaje);
  e.status = status;
  return e;
};

const repo = require("../data/respuestasAnulacionRepo");

const LARGO_MINIMO = 10;
const LARGO_MAXIMO = 100;
const MAXIMO_POR_CAJERO = 8;

function validarTexto(texto) {
  if (!texto || texto.trim().length < LARGO_MINIMO || texto.trim().length > LARGO_MAXIMO) {
    throw crearError(`El texto debe tener entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres.`, 400);
  }
}

/** TDSI-890: Listar. */
async function listar(cajero_id) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  return repo.listarPorCajero(cajero_id);
}

/** TDSI-891: Crear (con validación de 10 a 100 caracteres y máximo 8 por cajero). */
async function crear({ cajero_id, texto, orden }) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  validarTexto(texto);

  const actuales = await repo.contarPorCajero(cajero_id);
  if (actuales >= MAXIMO_POR_CAJERO) {
    throw crearError(`Ya tienes el máximo de ${MAXIMO_POR_CAJERO} respuestas de anulación. Elimina una para crear otra.`, 409);
  }

  return repo.crear({ cajero_id, texto: texto.trim(), orden });
}

/** TDSI-891: Editar. */
async function actualizar(id, cajero_id, { texto }) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  validarTexto(texto);
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw crearError("Respuesta no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw crearError("No tienes permiso para editar esta respuesta.", 403);
  }
  return repo.actualizar(id, cajero_id, { texto: texto.trim() });
}

/** TDSI-892: Eliminar. */
async function eliminar(id, cajero_id) {
  if (!cajero_id) throw crearError("Falta 'cajero_id'.", 400);
  const existente = await repo.obtenerPorId(id);
  if (!existente) throw crearError("Respuesta no encontrada.", 404);
  if (existente.cajero_id !== cajero_id) {
    throw crearError("No tienes permiso para eliminar esta respuesta.", 403);
  }
  await repo.eliminar(id, cajero_id);
  return { eliminado: true };
}

module.exports = { listar, crear, actualizar, eliminar };