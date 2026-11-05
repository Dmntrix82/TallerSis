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

/** TDSI-187: lista para el Administrador; nunca selecciona pin_hash */
async function listar() {
  const { rows } = await query(
    `SELECT id, supervisor_id, nombre, activo, intentos_fallidos, bloqueado_hasta,
            COALESCE(bloqueado_hasta > now(), false) AS bloqueado, actualizado_en
     FROM facturacion.supervisores
     ORDER BY nombre, supervisor_id`
  );
  return rows;
}

/** TDSI-721: alta de un supervisor; devuelve null si el usuario ya existe */
async function crear({ supervisor_id, nombre, pin_hash }) {
  const { rows } = await query(
    `INSERT INTO facturacion.supervisores (supervisor_id, nombre, pin_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (supervisor_id) DO NOTHING
     RETURNING id, supervisor_id, nombre, activo, bloqueado_hasta,
               false AS bloqueado, actualizado_en`,
    [supervisor_id, nombre, pin_hash]
  );
  return rows[0] || null;
}

/** TDSI-722: PIN nuevo, limpia intentos fallidos y bloqueo; null si no existe */
async function actualizarPin(id, pin_hash) {
  const { rows } = await query(
    `UPDATE facturacion.supervisores
     SET pin_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = now()
     WHERE id = $1
     RETURNING id, supervisor_id, nombre, activo, bloqueado_hasta,
               false AS bloqueado, actualizado_en`,
    [id, pin_hash]
  );
  return rows[0] || null;
}

/** TDSI-47/917: edita nombre y usuario; null si no existe. El UNIQUE de
 * supervisor_id puede lanzar un error (codigo 23505) si el usuario ya existe. */
async function actualizar(id, { supervisor_id, nombre }) {
  const { rows } = await query(
    `UPDATE facturacion.supervisores
     SET supervisor_id = $2, nombre = $3, actualizado_en = now()
     WHERE id = $1
     RETURNING id, supervisor_id, nombre, activo, bloqueado_hasta,
               COALESCE(bloqueado_hasta > now(), false) AS bloqueado, actualizado_en`,
    [id, supervisor_id, nombre]
  );
  return rows[0] || null;
}

/** TDSI-723: activa o desactiva al supervisor; null si no existe */
async function cambiarEstado(id, activo) {
  const { rows } = await query(
    `UPDATE facturacion.supervisores
     SET activo = $2, actualizado_en = now()
     WHERE id = $1
     RETURNING id, supervisor_id, nombre, activo, bloqueado_hasta,
               COALESCE(bloqueado_hasta > now(), false) AS bloqueado, actualizado_en`,
    [id, activo]
  );
  return rows[0] || null;
}

module.exports = {
  buscar, registrarFallo, reiniciarIntentos, guardarPin, listar, crear, actualizarPin,
  cambiarEstado, actualizar,
};