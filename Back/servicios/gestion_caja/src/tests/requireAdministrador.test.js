// TDSI-47/919: "Solo el Administrador gestiona las cuentas" -- las rutas de
// /api/usuarios exigen un access_token de Supabase Auth valido que ademas
// pertenezca a un administrador activo (caja.administradores). BD/Supabase
// reales; limpia las cuentas y filas que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const usuariosRoutes = require("../routes/usuariosRoutes");
const { requireAdministrador } = require("../middlewares/requireAdministrador");
const { errorHandler } = require("../middlewares/errorHandler");
const { crearCajero } = require("../services/adminUsuariosService");
const { autenticarCajero } = require("../services/authService");
const { query } = require("../config/db");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PREFIJO = `tdsi919-${Date.now()}`;
const emailDePrueba = (n) => `${PREFIJO}-${n}@test.com`;
const cuentasCreadas = [];

let base, servidor;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/usuarios", requireAdministrador, usuariosRoutes);
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/usuarios`;
});

test.after(async () => {
  servidor.close();
  for (const cajero_id of cuentasCreadas) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${cajero_id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
  }
  await query(`DELETE FROM caja.administradores WHERE cajero_id = ANY($1)`, [cuentasCreadas]);
  await query(`DELETE FROM caja.cajeros WHERE usuario LIKE $1`, [`${PREFIJO}%`]);
});

async function crearCuentaConPassword(n, password = "clave123") {
  const usuario = emailDePrueba(n);
  const cajero = await crearCajero({ usuario, password, nombre: `Prueba ${n}` });
  cuentasCreadas.push(cajero.cajero_id);
  return { usuario, cajero_id: cajero.cajero_id };
}

async function tokenDe(usuario, password = "clave123") {
  const sesion = await autenticarCajero({ email: usuario, password });
  return sesion.access_token;
}

test("TDSI-919: sin token responde 401", async () => {
  const r = await fetch(base);
  assert.equal(r.status, 401);
});

test("TDSI-919: un token invalido responde 401", async () => {
  const r = await fetch(base, { headers: { Authorization: "Bearer esto-no-es-un-token" } });
  assert.equal(r.status, 401);
});

test("TDSI-919: un cajero que no es administrador responde 403", async () => {
  const { usuario } = await crearCuentaConPassword(1);
  const token = await tokenDe(usuario);

  const r = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 403);
});

test("TDSI-919: un administrador activo puede usar /api/usuarios", async () => {
  const { usuario, cajero_id } = await crearCuentaConPassword(2);
  await query(
    `INSERT INTO caja.administradores (cajero_id, nombre, activo) VALUES ($1, $2, true)`,
    [cajero_id, "Admin de prueba"]
  );
  const token = await tokenDe(usuario);

  const r = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.ok(Array.isArray(cuerpo.data));
});

test("TDSI-919: un administrador desactivado responde 403", async () => {
  const { usuario, cajero_id } = await crearCuentaConPassword(3);
  await query(
    `INSERT INTO caja.administradores (cajero_id, nombre, activo) VALUES ($1, $2, false)`,
    [cajero_id, "Admin desactivado"]
  );
  const token = await tokenDe(usuario);

  const r = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 403);
});

test("TDSI-919: POST /api/usuarios/cajeros tambien exige ser administrador", async () => {
  const r = await fetch(`${base}/cajeros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: emailDePrueba("sin-token"), password: "clave123", nombre: "X" }),
  });
  assert.equal(r.status, 401);
});
