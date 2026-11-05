// TDSI-47/171: POST /api/usuarios/cajeros -- el Administrador registra un cajero
// nuevo. Crea de verdad una cuenta en Supabase Auth (requiere
// SUPABASE_SERVICE_ROLE_KEY) y el perfil en caja.cajeros. BD/Supabase reales;
// limpia las cuentas y filas que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCajero, listarUsuarios, editarUsuario, cambiarPasswordCajero } = require("../services/adminUsuariosService");
const { autenticarCajero } = require("../services/authService");
const { query } = require("../config/db");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

const PREFIJO = `tdsi171-${Date.now()}`;
const emailDePrueba = (n) => `${PREFIJO}-${n}@test.com`;
const cuentasCreadas = [];
const supervisoresCreados = [];
const supervisorIdsCreados = [];

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
  if (supervisoresCreados.length) {
    await query(`DELETE FROM facturacion.supervisores WHERE supervisor_id = ANY($1)`, [supervisoresCreados]);
  }
  if (supervisorIdsCreados.length) {
    await query(`DELETE FROM facturacion.supervisores WHERE id = ANY($1)`, [supervisorIdsCreados]);
  }
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

// TDSI-916: GET /api/usuarios -- cajeros y supervisores juntos, sin contrasena ni PIN.
test("TDSI-916: lista cajeros y supervisores juntos, con rol y estado, sin contrasena ni PIN", async () => {
  const usuarioCajero = emailDePrueba(5);
  const cajero = await crearCajero({ usuario: usuarioCajero, password: "clave123", nombre: "Elena Quispe" });
  cuentasCreadas.push(cajero.cajero_id);

  const supervisorId = `${PREFIJO}-SUP-1`;
  const r = await fetch(`${FACTURACION_URL}/api/supervisores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: supervisorId, nombre: "Hugo Rocha", pin: "4321" }),
  });
  assert.equal(r.status, 201, "el supervisor de prueba debe crearse para poder probar el listado");
  supervisoresCreados.push(supervisorId);

  const lista = await listarUsuarios();

  const filaCajero = lista.find((u) => u.usuario === usuarioCajero);
  assert.ok(filaCajero, "el cajero debe aparecer en el listado");
  assert.equal(filaCajero.nombre, "Elena Quispe");
  assert.equal(filaCajero.rol, "Cajero");
  assert.equal(filaCajero.estado, "Activo");
  assert.equal(filaCajero.password, undefined);

  const filaSupervisor = lista.find((u) => u.usuario === supervisorId);
  assert.ok(filaSupervisor, "el supervisor debe aparecer en el listado");
  assert.equal(filaSupervisor.nombre, "Hugo Rocha");
  assert.equal(filaSupervisor.rol, "Supervisor");
  assert.equal(filaSupervisor.estado, "Activo");
  assert.equal(filaSupervisor.pin, undefined);
  assert.equal(filaSupervisor.pin_hash, undefined);
});

test("TDSI-916: un cajero desactivado aparece como Inactivo", async () => {
  const usuario = emailDePrueba(6);
  const cajero = await crearCajero({ usuario, password: "clave123", nombre: "Pedro Villca" });
  cuentasCreadas.push(cajero.cajero_id);
  await query(`UPDATE caja.cajeros SET activo = false WHERE cajero_id = $1`, [cajero.cajero_id]);

  const lista = await listarUsuarios();
  const fila = lista.find((u) => u.usuario === usuario);
  assert.equal(fila.estado, "Inactivo");
});

// TDSI-917: PUT /api/usuarios/:id (nombre + usuario) y PUT /api/usuarios/cajeros/:id/password.
test("TDSI-917: edita el nombre y el usuario de un cajero", async () => {
  const usuarioViejo = emailDePrueba(7);
  const usuarioNuevo = emailDePrueba("7-nuevo");
  const cajero = await crearCajero({ usuario: usuarioViejo, password: "clave123", nombre: "Carla Flores" });
  cuentasCreadas.push(cajero.cajero_id);

  const r = await editarUsuario(cajero.cajero_id, { usuario: usuarioNuevo, nombre: "Carla F. Flores" });
  assert.equal(r.usuario, usuarioNuevo);
  assert.equal(r.nombre, "Carla F. Flores");

  const { rows } = await query(`SELECT usuario, nombre FROM caja.cajeros WHERE cajero_id = $1`, [cajero.cajero_id]);
  assert.equal(rows[0].usuario, usuarioNuevo);
  assert.equal(rows[0].nombre, "Carla F. Flores");

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${cajero.cajero_id}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const datos = await resp.json();
  assert.equal(datos.email, usuarioNuevo, "el correo de Supabase Auth tambien debe quedar actualizado");
});

test("TDSI-917: no deja editar un cajero a un usuario que ya existe", async () => {
  const ocupado = emailDePrueba(8);
  const otro = emailDePrueba(9);
  const c1 = await crearCajero({ usuario: ocupado, password: "clave123", nombre: "X" });
  cuentasCreadas.push(c1.cajero_id);
  const c2 = await crearCajero({ usuario: otro, password: "clave123", nombre: "Y" });
  cuentasCreadas.push(c2.cajero_id);

  await assert.rejects(
    () => editarUsuario(c2.cajero_id, { usuario: ocupado, nombre: "Y" }),
    (e) => e.status === 409
  );
});

test("TDSI-917: valida correo y nombre al editar un cajero", async () => {
  const cajero = await crearCajero({ usuario: emailDePrueba(10), password: "clave123", nombre: "X" });
  cuentasCreadas.push(cajero.cajero_id);

  await assert.rejects(
    () => editarUsuario(cajero.cajero_id, { usuario: "no-es-correo", nombre: "X" }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => editarUsuario(cajero.cajero_id, { usuario: emailDePrueba(11) }),
    (e) => e.status === 400
  );
});

test("TDSI-917: editar el mismo id tambien edita a un supervisor (nombre + usuario, sin PIN)", async () => {
  const usuarioViejo = `${PREFIJO}-SUP-917`;
  const usuarioNuevo = `${PREFIJO}-SUP-917-editado`;
  const r = await fetch(`${FACTURACION_URL}/api/supervisores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: usuarioViejo, nombre: "Hugo Rocha", pin: "5555" }),
  });
  const supervisor = (await r.json()).data;
  supervisorIdsCreados.push(supervisor.id);

  const editado = await editarUsuario(supervisor.id, { usuario: usuarioNuevo, nombre: "Hugo R. Rocha" });
  assert.equal(editado.usuario, usuarioNuevo);
  assert.equal(editado.nombre, "Hugo R. Rocha");
  assert.equal(editado.pin, undefined);
});

test("TDSI-917: cambia la contrasena de un cajero y permite iniciar sesion con la nueva", async () => {
  const usuario = emailDePrueba(12);
  const cajero = await crearCajero({ usuario, password: "claveVieja1", nombre: "Rosa Mamani" });
  cuentasCreadas.push(cajero.cajero_id);

  const r = await cambiarPasswordCajero(cajero.cajero_id, { password: "claveNueva1" });
  assert.equal(r.usuario, usuario);

  await assert.rejects(() => autenticarCajero({ email: usuario, password: "claveVieja1" }));
  const login = await autenticarCajero({ email: usuario, password: "claveNueva1" });
  assert.equal(login.email, usuario);
});

test("TDSI-917: rechaza una contrasena nueva muy corta y 404 si el cajero no existe", async () => {
  const cajero = await crearCajero({ usuario: emailDePrueba(13), password: "clave123", nombre: "X" });
  cuentasCreadas.push(cajero.cajero_id);

  await assert.rejects(
    () => cambiarPasswordCajero(cajero.cajero_id, { password: "123" }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => cambiarPasswordCajero("00000000-0000-0000-0000-000000000000", { password: "clave123" }),
    (e) => e.status === 404
  );
});
