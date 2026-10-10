const { AppError } = require("../utils/AppError");
const enviosRepo = require("../data/enviosContabilidadRepo");
const { enviarReporte } = require("../clients/contabilidadProxy");
const cfg = require("../config/integraciones");
const { consultarLote } = require("./loteCierreService");
const { armarReporte } = require("./reporteContabilidadService");

const ESTADOS_ENVIO = ["PENDIENTE", "ENVIADO", "ERROR"];

function validarSolicitadoPor(valor, porDefecto) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return porDefecto;
  if (texto.length > 60) throw new AppError("El campo 'solicitado_por' admite hasta 60 caracteres.", 400);
  return texto;
}

function validarId(id) {
  const limpio = String(id ?? "").trim();
  if (!/^\d{1,18}$/.test(limpio) || Number(limpio) === 0)
    throw new AppError("El id del envio debe ser un numero entero positivo.", 400);
  return limpio;
}

/**
 * TDSI-420/421/422: hace un intento de envio y deja registrado el resultado
 * (si falla y quedan intentos, queda PENDIENTE para que el worker lo reintente).
 * El Idempotency-Key es fijo por envio ("envio-<id>"), asi un reintento nunca
 * duplica el reporte en Contabilidad aunque el intento anterior si haya llegado.
 */
async function intentarEnvio(envio) {
  const payload = envio.payload || (await enviosRepo.obtenerPorId(envio.id, { conPayload: true })).payload;
  const r = await enviarReporte(payload, `envio-${envio.id}`);
  if (r.ok) return enviosRepo.marcarEnviado(envio, r);
  return enviosRepo.registrarFallo(envio, r, cfg.CONTABILIDAD_MAX_INTENTOS, cfg.CONTABILIDAD_BACKOFF_BASE_SEG);
}

/**
 * TDSI-421/122: arma el reporte del lote de la fecha (TDSI-419), registra el envio y lo intenta enviar.
 * Un lote se envia una sola vez: si ya tiene envio responde 409 con ese envio.
 */
async function enviarLote({ fecha, solicitado_por } = {}) {
  const lote = await consultarLote(fecha);
  const reporte = armarReporte(lote);
  const solicitadoPor = validarSolicitadoPor(solicitado_por, lote.generado_por);

  const { envio, yaExiste } = await enviosRepo.crearEnvio({ loteId: lote.id, payload: reporte, solicitadoPor });
  if (yaExiste) {
    throw new AppError(`El lote del ${lote.fecha} ya tiene un envio a Contabilidad (${yaExiste.estado}).`, 409, {
      codigo: "ENVIO_EXISTENTE",
      envio: yaExiste,
    });
  }
  return intentarEnvio(envio);
}

/**
 * TDSI-122: envio automatico al generar el lote. Nunca hace fallar la generacion:
 * si algo sale mal lo informa en { error } y el lote queda generado igual.
 */
async function enviarLoteAutomatico(lote) {
  if (!cfg.CONTABILIDAD_ENVIO_AUTOMATICO) return { automatico: false };
  try {
    return { automatico: true, envio: await enviarLote({ fecha: lote.fecha, solicitado_por: lote.generado_por }) };
  } catch (e) {
    console.error(`[contabilidad] No se pudo registrar el envio automatico del lote ${lote.fecha}:`, e.message);
    return { automatico: true, envio: e.detalle?.envio || null, error: e.message };
  }
}

/** TDSI-122: lista de envios para la seccion "Envios a Contabilidad" (filtro opcional por estado). */
async function listarEnvios({ estado, limite } = {}) {
  const estadoFiltro = estado ? String(estado).toUpperCase() : null;
  if (estadoFiltro && !ESTADOS_ENVIO.includes(estadoFiltro)) {
    throw new AppError(`El estado debe ser uno de: ${ESTADOS_ENVIO.join(", ")}.`, 400, { estado });
  }
  const lim = limite === undefined || limite === "" ? 50 : Number(limite);
  if (!Number.isInteger(lim) || lim < 1 || lim > 200) {
    throw new AppError("El 'limite' debe ser un entero entre 1 y 200.", 400, { limite });
  }
  const envios = await enviosRepo.listar({ estado: estadoFiltro, limite: lim });
  return { total: envios.length, envios };
}

/** TDSI-122: detalle de un envio, incluido el reporte que se envio. */
async function obtenerEnvio(id) {
  const envio = await enviosRepo.obtenerPorId(validarId(id), { conPayload: true });
  if (!envio) throw new AppError(`El envio ${id} no existe.`, 404);
  return envio;
}

/** TDSI-122/601: "Reenviar" un envio en ERROR: nuevo ciclo de intentos y un intento inmediato. */
async function reenviarEnvio(id, { solicitado_por } = {}) {
  const idValido = validarId(id);
  const solicitadoPor = validarSolicitadoPor(solicitado_por, null);

  const envio = await enviosRepo.prepararReenvio(idValido, solicitadoPor);
  if (!envio) {
    const actual = await enviosRepo.obtenerPorId(idValido);
    if (!actual) throw new AppError(`El envio ${id} no existe.`, 404);
    throw new AppError(`Solo se pueden reenviar envios con estado ERROR (este esta ${actual.estado}).`, 409, {
      codigo: "ENVIO_NO_REENVIABLE",
      envio: actual,
    });
  }
  return intentarEnvio(envio);
}

module.exports = { enviarLote, enviarLoteAutomatico, intentarEnvio, listarEnvios, obtenerEnvio, reenviarEnvio };