const { query } = require("../config/db");

const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * TDSI-62/963/964: apertura, cierre y aprobacion de operaciones especiales, para el
 * "Historial de operaciones" del Administrador -- las ventas y anulaciones de factura
 * viven en gestion_pagos (su propio historial, TDSI-956); esto completa las otras
 * autorizaciones que pide el ticket (regla: "aplica a toda autorizacion con usuario
 * y PIN que ya existe: apertura y cierre de caja, anulacion de factura y aprobacion
 * de operaciones").
 */
async function listar({ inicio, fin, supervisorId = null }) {
  const { rows } = await query(
    `
    SELECT 'APERTURA' AS tipo, t.abierto_en AS fecha, t.caja_id, t.cajero_id AS pedido_por,
           t.autorizado_por, t.autorizado_por_nombre,
           NULL::numeric AS monto, NULL::text AS descripcion
      FROM caja.turnos t
     WHERE t.abierto_en >= $1 AND t.abierto_en <= $2
       AND ($3::text IS NULL OR t.autorizado_por = $3)

    UNION ALL

    SELECT 'CIERRE' AS tipo, t.cerrado_en AS fecha, t.caja_id, t.cajero_id AS pedido_por,
           t.cerrado_por AS autorizado_por, t.cerrado_por_nombre AS autorizado_por_nombre,
           NULL::numeric AS monto, NULL::text AS descripcion
      FROM caja.turnos t
     WHERE t.estado = 'CERRADO' AND t.cerrado_en >= $1 AND t.cerrado_en <= $2
       AND ($3::text IS NULL OR t.cerrado_por = $3)

    UNION ALL

    SELECT 'OPERACION_ESPECIAL' AS tipo, a.creado_en AS fecha, a.caja_id, a.solicitado_por AS pedido_por,
           a.autorizado_por, a.autorizado_por_nombre,
           a.monto, a.descripcion
      FROM caja.aprobaciones_especiales a
     WHERE a.creado_en >= $1 AND a.creado_en <= $2
       AND ($3::text IS NULL OR a.autorizado_por = $3)

    ORDER BY fecha DESC
    `,
    [inicio, fin, supervisorId]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

module.exports = { listar };
