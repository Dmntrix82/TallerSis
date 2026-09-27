const { query } = require("../config/db");

async function insertarDocumento({ factura_id, tipo, ruta_o_url, estado, generado_en }) {
  const { rows } = await query(
    `INSERT INTO facturacion.factura_documentos (factura_id, tipo, ruta_o_url, estado, generado_en)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, factura_id, tipo, ruta_o_url, estado, generado_en, entregado, entregado_en`,
    [factura_id, tipo, ruta_o_url, estado, generado_en]
  );
  return rows[0];
}

async function buscarPorFacturaYTipo(factura_id, tipo) {
  const { rows } = await query(
    `SELECT id, factura_id, tipo, ruta_o_url, estado, generado_en, entregado, entregado_en
     FROM facturacion.factura_documentos WHERE factura_id = $1 AND tipo = $2
     ORDER BY id DESC LIMIT 1`,
    [factura_id, tipo]
  );
  return rows[0] || null;
}

/** TDSI-354: registra que el documento fue entregado correctamente al Sistema Cliente */
async function marcarEntregado(id) {
  const { rows } = await query(
    `UPDATE facturacion.factura_documentos
     SET entregado = true, entregado_en = now()
     WHERE id = $1
     RETURNING id, factura_id, tipo, ruta_o_url, estado, generado_en, entregado, entregado_en`,
    [id]
  );
  return rows[0];
}

async function listarPorFactura(factura_id) {
  const { rows } = await query(
    `SELECT id, factura_id, tipo, ruta_o_url, estado, generado_en, entregado, entregado_en
     FROM facturacion.factura_documentos WHERE factura_id = $1 ORDER BY id`,
    [factura_id]
  );
  return rows;
}

module.exports = { insertarDocumento, buscarPorFacturaYTipo, marcarEntregado, listarPorFactura };
