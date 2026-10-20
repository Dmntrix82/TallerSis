const repo = require("../data/enviosContabilidadRepo");

// referencia_externa de nuestros envios: "F-000001" (venta) o "ANU-F-000001" (anulacion)
const REFERENCIA = /^(ANU-)?(F-\d+)$/;

/**
 * TDSI-22: interpreta un mensaje del topico del Grupo A. Devuelve null si no es una
 * respuesta de Contabilidad a una factura nuestra (resultado_documento de FACTURACION).
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
  if (!ref || !r.estado) return null;
  return {
    referencia: ref[0],
    facturaNumero: ref[2],
    tipo: ref[1] ? "anulacion" : "venta",
    resultado: String(r.estado).trim().toLowerCase().slice(0, 20),
    numeroAsiento: r.numero_asiento != null ? String(r.numero_asiento).slice(0, 30) : null,
    motivo: r.motivo ? String(r.motivo).slice(0, 400) : null,
  };
}

/**
 * Guarda el resultado en el envio de esa factura. propio = true solo si el mensaje
 * corresponde a un envio nuestro: esos se confirman (ack); el resto se deja para otros.
 */
async function procesarMensaje({ texto, messageId }) {
  const datos = interpretar(texto);
  if (!datos) return { propio: false };
  const envio = await repo.registrarResultado({ ...datos, messageId });
  return { propio: Boolean(envio), referencia: datos.referencia, resultado: datos.resultado, envio };
}

module.exports = { interpretar, procesarMensaje };
