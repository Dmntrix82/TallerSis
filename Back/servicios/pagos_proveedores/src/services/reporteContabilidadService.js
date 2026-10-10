const { AppError } = require("../utils/AppError");
const { consultarLote } = require("./loteCierreService");

const ESTADOS_REPORTABLES = ["GENERADO", "ENVIADO"];
const num = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * TDSI-419: arma el reporte (JSON) que se envia a Contabilidad a partir de un lote ya generado.
 * Los totales salen de las columnas del lote (lo que se guardo y valido en TDSI-417);
 * el desglose (por metodo, cantidad de ventas, etc.) sale de lote.detalle.
 * Es una funcion pura para poder probarla sin BD.
 */
function armarReporte(lote, { emitidoEn = new Date() } = {}) {
  if (!lote || !lote.fecha) throw new AppError("No hay lote para armar el reporte.", 400);
  if (!ESTADOS_REPORTABLES.includes(lote.estado)) {
    throw new AppError(`El lote del ${lote.fecha} esta en estado ${lote.estado} y no se puede reportar.`, 409, {
      estado: lote.estado,
    });
  }

  const detalle = lote.detalle || {};
  const ingresos = detalle.ingresos || {};
  const egresos = detalle.egresos || {};
  const periodo = detalle.periodoContable?.periodo || lote.fecha.slice(0, 7);

  return {
    tipo: "REPORTE_CIERRE_DIARIO",
    version: 1,
    origen: "TALLERSIS_PAGOS_PROVEEDORES",
    lote_id: Number(lote.id),
    fecha: lote.fecha,
    periodo,
    moneda: "BOB",
    ingresos: {
      total: num(lote.total_ingresos),
      efectivo: num(ingresos.efectivo),
      tarjeta: num(ingresos.tarjeta),
      qr: num(ingresos.qr),
      cantidad_ventas: ingresos.cantidadVentas || 0,
      cantidad_anuladas: ingresos.cantidadAnuladas || 0,
      monto_anulado: num(ingresos.montoAnulado),
    },
    egresos: {
      total: num(lote.total_egresos),
      cantidad: egresos.cantidad || 0,
      por_metodo: (egresos.porMetodo || []).map((m) => ({
        metodo: m.metodo,
        total: num(m.total),
        cantidad: m.cantidad,
      })),
    },
    impuestos: {
      total: num(lote.total_impuestos),
      detalle: [
        {
          tipo: "IVA",
          porcentaje: num(lote.iva_porcentaje),
          base_imponible: num(lote.total_ingresos),
          monto: num(lote.total_impuestos),
        },
      ],
    },
    neto: num(lote.total_neto),
    datos_simulados: Boolean(lote.modo_aislado),
    generado_por: lote.generado_por,
    generado_en: lote.generado_en instanceof Date ? lote.generado_en.toISOString() : lote.generado_en,
    emitido_en: emitidoEn.toISOString(),
  };
}

/** TDSI-419: busca el lote de la fecha (404 si no existe) y arma su reporte. */
async function obtenerReporteDeFecha(fecha) {
  const lote = await consultarLote(fecha);
  return armarReporte(lote);
}

module.exports = { armarReporte, obtenerReporteDeFecha };