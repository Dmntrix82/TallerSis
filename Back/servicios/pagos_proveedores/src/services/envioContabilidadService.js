const { AppError } = require("../utils/AppError");
const enviosRepo = require("../data/enviosContabilidadRepo");
const { enviarReporte } = require("../clients/contabilidadProxy");
const { consultarLote } = require("./loteCierreService");
const { armarReporte } = require("./reporteContabilidadService");

function validarSolicitadoPor(valor, porDefecto) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return porDefecto;
  if (texto.length > 60) throw new AppError("El campo 'solicitado_por' admite hasta 60 caracteres.", 400);
  return texto;
}

/**
 * TDSI-420/421: hace un intento de envio y deja registrado el resultado.
 * El Idempotency-Key es fijo por envio ("envio-<id>"), asi un reintento nunca
 * duplica el reporte en Contabilidad aunque el intento anterior si haya llegado.
 */
async function intentarEnvio(envio) {
  const payload = envio.payload || (await enviosRepo.obtenerPorId(envio.id, { conPayload: true })).payload;
  const r = await enviarReporte(payload, `envio-${envio.id}`);
  if (r.ok) return enviosRepo.marcarEnviado(envio, r);
  return enviosRepo.registrarFallo(envio, r);
}

/**
 * TDSI-421: arma el reporte del lote de la fecha (TDSI-419), registra el envio y lo intenta enviar.
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

module.exports = { enviarLote, intentarEnvio };