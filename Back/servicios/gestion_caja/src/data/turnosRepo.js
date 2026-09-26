const { query } = require("../config/db");

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

module.exports = { obtenerTurnoPorId, marcarCerrado };