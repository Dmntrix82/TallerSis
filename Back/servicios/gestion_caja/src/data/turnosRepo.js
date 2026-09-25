const { query } = require("../config/db");

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

module.exports = { buscarCajaPorCodigo, crearTurno };