const { query } = require("../config/db");

// ==================== Apertura (TDSI-311/312) ====================

async function buscarCajaPorCodigo(codigo) {
  const { rows } = await query(
    `SELECT id, codigo, nombre, estado FROM caja.cajas WHERE codigo = $1`,
    [codigo]
  );
  return rows[0] || null;
}

async function crearTurno({ caja_id, cajero_id, efectivo_inicial }) {
  const { rows } = await query(
    `WITH nuevo AS (
       SELECT nextval(pg_get_serial_sequence('caja.turnos', 'id')) AS id
     )
     INSERT INTO caja.turnos (id, codigo, caja_id, cajero_id, efectivo_inicial)
     SELECT id, 'TUR-' || lpad(id::text, 6, '0'), $1, $2, $3 FROM nuevo
     RETURNING
       id::int                                                AS id,
       codigo,
       caja_id,
       cajero_id,
       efectivo_inicial,
       estado,
       to_char(abierto_en AT TIME ZONE 'America/La_Paz',
               'YYYY-MM-DD"T"HH24:MI:SS.MS') || '-04:00'      AS abierto_en,
       to_char(abierto_en AT TIME ZONE 'America/La_Paz',
               'YYYY-MM-DD')                                  AS fecha_apertura,
       to_char(abierto_en AT TIME ZONE 'America/La_Paz',
               'HH24:MI:SS')                                  AS hora_apertura`,
    [caja_id, cajero_id, efectivo_inicial]
  );
  return rows[0];
}
// TDSI-313: no permitir dos turnos abiertos en la misma caja
async function buscarTurnoAbiertoPorCaja(caja_id) {
  const { rows } = await query(
    `SELECT id, codigo
       FROM caja.turnos
      WHERE caja_id = $1
        AND estado = 'ABIERTO'
      LIMIT 1`,
    [caja_id]
  );
  return rows[0] || null;
}
// ==================== Cierre (TDSI-319 a 322, viene de main) ====================

async function obtenerTurnoPorId(turnoId) {
  const { rows } = await query(`SELECT * FROM caja.turnos WHERE id = $1`, [turnoId]);
  return rows[0] || null;
}

async function marcarCerrado(turnoId, { efectivoContado, efectivoEsperado, diferencia, tipoDiferencia }) {
  const { rows } = await query(
    `UPDATE caja.turnos
        SET estado = 'CERRADO', cerrado_en = now(),
            efectivo_contado = $2, efectivo_esperado = $3, diferencia = $4, tipo_diferencia = $5
      WHERE id = $1
      RETURNING *`,
    [turnoId, efectivoContado, efectivoEsperado, diferencia, tipoDiferencia]
  );
  return rows[0];
}

module.exports = {
  buscarCajaPorCodigo,
  crearTurno,
  buscarTurnoAbiertoPorCaja,
  obtenerTurnoPorId,
  marcarCerrado,
};