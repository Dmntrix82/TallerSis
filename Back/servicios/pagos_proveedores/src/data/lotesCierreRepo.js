const { query } = require("../config/db");

async function sumarEgresoDelDia(monto) {
  const resultado = await query(
    `INSERT INTO proveedores.lotes_cierre_diario (fecha, total_egresos)
     VALUES (CURRENT_DATE, $1)
     ON CONFLICT (fecha) DO UPDATE
       SET total_egresos = proveedores.lotes_cierre_diario.total_egresos + EXCLUDED.total_egresos
     RETURNING id, fecha, total_ingresos, total_egresos, total_impuestos, estado`,
    [monto]
  );
  return resultado.rows[0];
}

module.exports = { sumarEgresoDelDia };
