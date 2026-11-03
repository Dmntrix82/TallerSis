const { AppError } = require("../utils/AppError");
const { aCentavos, aMonto } = require("../utils/money");
const { ZONA } = require("../utils/fechas");

// Fecha del turno en hora de Bolivia (YYYY-MM-DD) -- un cierre de las 22:00 es de ese
// dia, no del siguiente. Mismo criterio que fechaBolivia() en facturacion/contabilidadService.js.
const fechaLocal = (v) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(v));

/**
 * TDSI-52: arma el mensaje "diferencia_caja" en el mismo formato que ya acepta
 * Contabilidad para las facturas (sistema_origen, referencia_externa, tipo_operacion,
 * fecha_documento, datos) -- ver facturacion/src/services/contabilidadService.js.
 * referencia_externa = "DIF-<id>" para que no la tomen como duplicado de una factura.
 * Esto SOLO arma el mensaje (una funcion pura); publicarlo es un subtask aparte.
 */
function armarMensajeDiferencia({ diferencia, turno }) {
  if (!diferencia || diferencia.id == null) {
    throw new AppError("Falta la diferencia a informar a Contabilidad.", 400);
  }
  if (!["FALTANTE", "SOBRANTE"].includes(diferencia.tipo)) {
    throw new AppError("El tipo de diferencia debe ser FALTANTE o SOBRANTE.", 400, { tipo: diferencia.tipo });
  }
  const justificacion = String(diferencia.justificacion || "").trim();
  if (!justificacion) {
    throw new AppError("La diferencia necesita una justificación antes de informarla a Contabilidad.", 400);
  }
  if (!turno || !turno.caja_id) {
    throw new AppError("Falta el turno (con su caja) de la diferencia a informar.", 400);
  }

  const fechaTurno = fechaLocal(turno.cerrado_en || turno.abierto_en);

  return {
    sistema_origen: "GESTION_CAJA",
    referencia_externa: `DIF-${diferencia.id}`,
    tipo_operacion: "diferencia_caja",
    fecha_documento: fechaTurno,
    datos: {
      caja: turno.caja_id,
      cajero: turno.cajero_nombre || turno.cajero_id || null,
      fecha_turno: fechaTurno,
      tipo: diferencia.tipo,
      monto: aMonto(aCentavos(diferencia.monto)),
      justificacion,
    },
  };
}

module.exports = { armarMensajeDiferencia };
