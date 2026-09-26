const { query } = require("../config/db");

async function buscarPorId(id) {
  const resultado = await query(
    "SELECT id, numero, proveedor_razon_social, monto, estado FROM proveedores.ordenes_pago WHERE id = $1",
    [id]
  );
  return resultado.rows[0] || null;
}

async function marcarLiquidada(id, liquidada_por) {
  const resultado = await query(
    `UPDATE proveedores.ordenes_pago
     SET estado = 'LIQUIDADA', liquidada_en = now(), liquidada_por = $2
     WHERE id = $1
     RETURNING id, numero, estado, liquidada_en, liquidada_por`,
    [id, liquidada_por || null]
  );
  return resultado.rows[0];
}

module.exports = { buscarPorId, marcarLiquidada };
