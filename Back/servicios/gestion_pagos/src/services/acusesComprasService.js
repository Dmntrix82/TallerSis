const repo = require("../data/enviosComprasRepo");

// Nuestro propio identificador: "PV-2021-10-12"
const REFERENCIA = /^PV-(\d{4}-\d{2}-\d{2})$/;

/**
 * TDSI-697: interpreta un mensaje del topico "compras-acuses". Devuelve null si no es
 * un acuse de Compras para un reporte nuestro (reporte_id con forma PV-<fecha>).
 */
function interpretar(texto) {
  let r;
  try {
    r = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!r || r.origen !== "compras") return null;
  const ref = REFERENCIA.exec(String(r.reporte_id || "").trim());
  if (!ref) return null;
  return { reporteId: ref[0], fecha: ref[1] };
}

/**
 * Marca como Recibido el envio de esa fecha. propio = true siempre que el mensaje sea
 * reconocible como un acuse nuestro (aunque no haya cambiado nada, p.ej. un acuse
 * repetido): ese mensaje nunca le sirve a nadie mas, asi que igual se confirma (ack).
 */
async function procesarMensaje({ texto }) {
  const datos = interpretar(texto);
  if (!datos) return { propio: false };
  const envio = await repo.marcarRecibido(datos.fecha);
  return { propio: true, reporteId: datos.reporteId, envio };
}

module.exports = { interpretar, procesarMensaje };
