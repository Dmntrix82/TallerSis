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

module.exports = { insertarEgreso };
