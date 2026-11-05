// TDSI-47/171: POST /api/usuarios/cajeros -- el Administrador registra un cajero
// nuevo. Crea de verdad una cuenta en Supabase Auth (requiere
// SUPABASE_SERVICE_ROLE_KEY) y el perfil en caja.cajeros. BD/Supabase reales;
// limpia las cuentas y filas que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCajero } = require("../services/adminUsuariosService");
const { query } = require("../config/db");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PREFIJO = `tdsi171-${Date.now()}`;
const emailDePrueba = (n) => `${PREFIJO}-${n}@test.com`;
const cuentasCreadas = [];

async function borrarCuentaSupabase(cajero_id) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${cajero_id}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
}

test.after(async () => {
  for (const cajero_id of cuentasCreadas) {
    await borrarCuentaSupabase(cajero_id);
  }
  await query(`DELETE FROM caja.cajeros WHERE usuario LIKE $1`, [`${PREFIJO}%`]);
});

test("TDSI-171: registra un cajero (cuenta en Supabase Auth + perfil en caja.cajeros)", async () => {
  const usuario = emailDePrueba(1);
  const r = await crearCajero({ usuario, password: "clave123", nombre: "Juana Perez" });
  cuentasCreadas.push(r.cajero_id);

  assert.equal(r.usuario, usuario);
  assert.equal(r.nombre, "Juana Perez");
  assert.equal(r.rol, "Cajero");
  assert.equal(r.estado, "Activo");
  assert.ok(r.cajero_id);

  const { rows } = await query(`SELECT * FROM caja.cajeros WHERE cajero_id = $1`, [r.cajero_id]);
  assert.equal(rows[0].usuario, usuario);
  assert.equal(rows[0].nombre, "Juana Perez");
  assert.equal(rows[0].activo, true);
});

test("TDSI-171: el usuario (correo) no se puede repetir", async () => {
  const usuario = emailDePrueba(2);
  const primero = await crearCajero({ usuario, password: "clave123", nombre: "Marco Soliz" });
  cuentasCreadas.push(primero.cajero_id);

  await assert.rejects(
    () => crearCajero({ usuario, password: "otraClave1", nombre: "Otro Nombre" }),
    (e) => e.status === 409
  );
});

test("TDSI-171: rechaza un correo invalido", async () => {
  await assert.rejects(
    () => crearCajero({ usuario: "no-es-un-correo", password: "clave123", nombre: "X" }),
    (e) => e.status === 400
  );
});

test("TDSI-171: rechaza una contrasena muy corta", async () => {
  await assert.rejects(
    () => crearCajero({ usuario: emailDePrueba(3), password: "123", nombre: "X" }),
    (e) => e.status === 400
  );
});

test("TDSI-171: rechaza si falta el nombre", async () => {
  await assert.rejects(
    () => crearCajero({ usuario: emailDePrueba(4), password: "clave123" }),
    (e) => e.status === 400
  );
});
