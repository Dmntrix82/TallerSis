const { AppError } = require("../utils/AppError");
const { consultarLote } = require("./loteCierreService");
const cfg = require("../config/integraciones");

const ESTADOS_REPORTABLES = ["GENERADO", "ENVIADO"];
const num = (v) => Math.round(Number(v || 0) * 100) / 100;
const centavos = (v) => Math.round(Number(v || 0) * 100);
const sumar = (valores) => valores.reduce((acc, v) => acc + centavos(v), 0) / 100;

/**
 * TDSI-419: arma el reporte (JSON) que se envia a Contabilidad a partir de un lote ya generado.
 * Los totales salen de las columnas del lote (lo que se guardo y valido en TDSI-417);
 * el desglose (por metodo, cantidad de ventas, etc.) sale de lote.detalle.
 * Es una funcion pura para poder probarla sin BD.
 * TDSI-22 (version 2): agrega empresa, periodo contable, el detalle de cada egreso
 * (orden de pago y proveedor) y un bloque "cuadre" para que Contabilidad valide los totales.
 * Los campos de la version 1 se mantienen igual.
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
  // Se rearma cada egreso con un orden fijo de campos (el detalle del lote vuelve de JSONB reordenado).
  const egresosDetalle = (egresos.detalle || []).map((e) => ({
    egreso_id: e.egreso_id,
    orden_pago: e.orden_pago,
    orden_compra_id: e.orden_compra_id,
    proveedor: { nit: e.proveedor?.nit ?? null, razon_social: e.proveedor?.razon_social ?? null },
    concepto: e.concepto ?? null,
    metodo: e.metodo,
    monto: num(e.monto),
    registrado_por: e.registrado_por ?? null,
    registrado_en: e.registrado_en,
  }));

  const totalIngresos = num(lote.total_ingresos);
  const totalEgresos = num(lote.total_egresos);
  const totalImpuestos = num(lote.total_impuestos);
  const ingresosPorMetodo = sumar([ingresos.efectivo, ingresos.tarjeta, ingresos.qr]);
  const egresosSumaDetalle = sumar(egresosDetalle.map((e) => e.monto));
  const netoCalculado = (centavos(totalIngresos) - centavos(totalEgresos) - centavos(totalImpuestos)) / 100;

  return {
    tipo: "REPORTE_CIERRE_DIARIO",
    version: 2,
    id_mensaje: `lote-${Number(lote.id)}`,
    origen: "TALLERSIS_PAGOS_PROVEEDORES",
    empresa: cfg.EMPRESA,
    lote_id: Number(lote.id),
    fecha: lote.fecha,
    periodo,
    periodo_contable: { periodo, estado: detalle.periodoContable?.abierto === false ? "CERRADO" : "ABIERTO" },
    moneda: "BOB",
    ingresos: {
      origen: ingresos.origen || null,
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
      detalle: egresosDetalle,
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
    cuadre: {
      ingresos_por_metodo: ingresosPorMetodo,
      ingresos_cuadra: ingresosPorMetodo === totalIngresos,
      egresos_detalle: egresosSumaDetalle,
      // null: lote anterior a la version 2 (sin detalle de egresos guardado)
      egresos_cuadra: egresosDetalle.length === 0 && totalEgresos !== 0 ? null : egresosSumaDetalle === totalEgresos,
      neto_calculado: netoCalculado,
      neto_cuadra: netoCalculado === num(lote.total_neto),
    },
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