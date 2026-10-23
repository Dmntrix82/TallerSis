const { query } = require("../config/db");

// fecha::text evita que pg la convierta a Date con la zona horaria del servidor.
const COLUMNAS = `id, fecha::text AS fecha, total_ingresos, total_egresos, total_impuestos, total_neto,
                  iva_porcentaje, estado, modo_aislado, detalle, generado_por, generado_en`;

const num = (v) => (v === null || v === undefined ? null : Number(v));

function aLote(fila) {
  if (!fila) return null;
  return {
    ...fila,
    total_ingresos: num(fila.total_ingresos),
    total_egresos: num(fila.total_egresos),
    total_impuestos: num(fila.total_impuestos),
    total_neto: num(fila.total_neto),
    iva_porcentaje: num(fila.iva_porcentaje),
  };
}

/**
 * TDSI-401: acumula el egreso en el flujo del dia (fila EN_CURSO).
 * TDSI-417: si el lote de ese dia ya fue generado no se toca y devuelve null.
 */
async function sumarEgresoDelDia(monto) {
  const resultado = await query(
    `INSERT INTO proveedores.lotes_cierre_diario (fecha, total_egresos, estado)
     VALUES ((now() AT TIME ZONE 'America/La_Paz')::date, $1, 'EN_CURSO')
     ON CONFLICT (fecha) DO UPDATE
       SET total_egresos = proveedores.lotes_cierre_diario.total_egresos + EXCLUDED.total_egresos
       WHERE proveedores.lotes_cierre_diario.estado = 'EN_CURSO'
     RETURNING ${COLUMNAS}`,
    [monto]
  );
  return aLote(resultado.rows[0]);
}

/** TDSI-417: lote ya generado de una fecha (la fila EN_CURSO de TDSI-401 no cuenta como lote). */
async function obtenerPorFecha(fecha) {
  const resultado = await query(
    `SELECT ${COLUMNAS}
     FROM proveedores.lotes_cierre_diario
     WHERE fecha = $1::date AND estado <> 'EN_CURSO'`,
    [fecha]
  );
  return aLote(resultado.rows[0]);
}

/**
 * TDSI-417: guarda el lote de la fecha sin duplicarla.
 * - Si no hay fila, la inserta como GENERADO.
 * - Si hay una fila EN_CURSO (flujo de TDSI-401), la reemplaza con los totales del lote.
 * - Si ya hay un lote GENERADO/ENVIADO no modifica nada y devuelve null.
 * Todo en una sola sentencia: dos solicitudes simultaneas nunca generan dos lotes.
 */
async function guardarLote({ fecha, totalIngresos, totalEgresos, totalImpuestos, totalNeto,
                             ivaPorcentaje, modoAislado, detalle, generadoPor }) {
  const resultado = await query(
    `INSERT INTO proveedores.lotes_cierre_diario
       (fecha, total_ingresos, total_egresos, total_impuestos, total_neto,
        iva_porcentaje, modo_aislado, detalle, estado, generado_por, generado_en)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, 'GENERADO', $9, now())
     ON CONFLICT (fecha) DO UPDATE
       SET total_ingresos  = EXCLUDED.total_ingresos,
           total_egresos   = EXCLUDED.total_egresos,
           total_impuestos = EXCLUDED.total_impuestos,
           total_neto      = EXCLUDED.total_neto,
           iva_porcentaje  = EXCLUDED.iva_porcentaje,
           modo_aislado    = EXCLUDED.modo_aislado,
           detalle         = EXCLUDED.detalle,
           estado          = 'GENERADO',
           generado_por    = EXCLUDED.generado_por,
           generado_en     = now()
       WHERE proveedores.lotes_cierre_diario.estado = 'EN_CURSO'
     RETURNING ${COLUMNAS}`,
    [fecha, totalIngresos, totalEgresos, totalImpuestos, totalNeto,
     ivaPorcentaje, modoAislado, JSON.stringify(detalle || null), generadoPor]
  );
  return aLote(resultado.rows[0]);
}

module.exports = { sumarEgresoDelDia, obtenerPorFecha, guardarLote };