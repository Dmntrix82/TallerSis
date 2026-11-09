const repo = require("../data/diferenciasEnviosRepo");

// referencia_externa de nuestros envios: "DIF-123"
const REFERENCIA = /^DIF-(\d+)$/;

const ESTADO_POR_RESULTADO = { aceptado: "Confirmado", rechazado: "Rechazado" };

/**
 * TDSI-700: interpreta un mensaje del topico del Grupo A. Devuelve null si no es una
 * respuesta de Contabilidad a una diferencia nuestra (resultado_documento de una
 * referencia DIF-<id>) -- el resto (p.ej. las respuestas F-NNNNNN de facturacion, o un
 * resultado que no sea "aceptado"/"rechazado") se libera para que lo lea quien le toque.
 */
function interpretar(texto) {
  let r;
  try {
    r = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!r || r.sistema_origen !== "CONTABILIDAD" || r.tipo_mensaje !== "resultado_documento") return null;
  const ref = REFERENCIA.exec(String(r.referencia_externa || "").trim());
  if (!ref) return null;
  const estado = ESTADO_POR_RESULTADO[String(r.estado || "").trim().toLowerCase()];
  if (!estado) return null;
  return {
    referencia: ref[0],
    diferenciaId: Number(ref[1]),
    estado,
    motivo: r.motivo ? String(r.motivo).slice(0, 400) : null,
  };
}

/**
 * Guarda el resultado en el envio de esa diferencia. propio = true solo si el mensaje
 * corresponde a un envio nuestro: esos se confirman (ack); el resto se deja para otros.
 */
async function procesarMensaje({ texto }) {
  const datos = interpretar(texto);
  if (!datos) return { propio: false };
  const envio = await repo.registrarResultado(datos.diferenciaId, { estado: datos.estado, motivo: datos.motivo });
  return { propio: Boolean(envio), referencia: datos.referencia, estado: datos.estado, envio };
}

module.exports = { interpretar, procesarMensaje };
