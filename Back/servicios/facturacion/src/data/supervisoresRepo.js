const { query } = require("../config/db");

async function buscar(supervisorId) {
  const { rows } = await query(
    `SELECT supervisor_id, nombre, pin_hash, activo, intentos_fallidos,
            bloqueado_hasta, (bloqueado_hasta > now()) AS bloqueado
     FROM facturacion.supervisores WHERE supervisor_id = $1`,
    [supervisorId]
  );
  return rows[0] || null;
}

/** TDSI-386: suma un fallo; al llegar al maximo, bloquea y reinicia el contador */
async function registrarFallo(supervisorId, maxIntentos, bloqueoMin) {
  const { rows } = await query(
    `UPDATE facturacion.supervisores
     SET intentos_fallidos = CASE
           WHEN intentos_fallidos + 1 >= $2 THEN 0
           ELSE intentos_fallidos + 1
         END,
         bloqueado_hasta = CASE
           WHEN intentos_fallidos + 1 >= $2 THEN now() + make_interval(mins => $3)
           ELSE bloqueado_hasta
         END,
         actualizado_en = now()
     WHERE supervisor_id = $1
     RETURNING intentos_fallidos, bloqueado_hasta, (bloqueado_hasta > now()) AS bloqueado`,
    [supervisorId, maxIntentos, bloqueoMin]
  );
  return rows[0];
}

async function reiniciarIntentos(supervisorId) {
  await query(
    `UPDATE facturacion.supervisores
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = now()
     WHERE supervisor_id = $1`,
    [supervisorId]
  );
}

async function guardarPin({ supervisor_id, nombre, pin_hash }) {
  const { rows } = await query(
    `INSERT INTO facturacion.supervisores (supervisor_id, nombre, pin_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (supervisor_id) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           pin_hash = EXCLUDED.pin_hash,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           actualizado_en = now()
     RETURNING supervisor_id, nombre, activo`,
    [supervisor_id, nombre, pin_hash]
  );
  return rows[0];
}

module.exports = { buscar, registrarFallo, reiniciarIntentos, guardarPin };