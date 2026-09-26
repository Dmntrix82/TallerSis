const { query } = require("../config/db");

async function insertarEgreso({ orden_pago_id, monto, metodo, descripcion, registrado_por }) {
  const resultado = await query(
    `INSERT INTO proveedores.egresos (orden_pago_id, monto, metodo, descripcion, registrado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, orden_pago_id, monto, metodo, descripcion, registrado_por, registrado_en`,
    [orden_pago_id, monto, metodo, descripcion || null, registrado_por || null]
  );
  return resultado.rows[0];
}

async function listarEgresos() {
  const resultado = await query(
    `SELECT e.id, e.orden_pago_id, o.numero AS orden_numero, o.proveedor_razon_social,
            e.monto, e.metodo, e.descripcion, e.registrado_por, e.registrado_en
     FROM proveedores.egresos e
     JOIN proveedores.ordenes_pago o ON o.id = e.orden_pago_id
     ORDER BY e.registrado_en DESC`
  );
  return resultado.rows;
}

module.exports = { insertarEgreso, listarEgresos };
