const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { consultarEstadoCajas } = require("../services/cajaService");

const CAJA_ACTIVA_LIBRE = "TEST-CAJA-LIBRE";
const CAJA_ACTIVA_OCUPADA = "TEST-CAJA-OCUPADA";
const CAJA_INACTIVA = "TEST-CAJA-INACTIVA";

async function limpiar() {
  await query(
    `DELETE FROM caja.turnos WHERE caja_id IN ($1, $2, $3)`,
    [CAJA_ACTIVA_LIBRE, CAJA_ACTIVA_OCUPADA, CAJA_INACTIVA]
  );
  await query(
    `DELETE FROM caja.cajas WHERE codigo IN ($1, $2, $3)`,
    [CAJA_ACTIVA_LIBRE, CAJA_ACTIVA_OCUPADA, CAJA_INACTIVA]
  );
}

test.before(async () => {
  await limpiar();

  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado) VALUES
     ($1, 'Caja test libre',   'ACTIVA'),
     ($2, 'Caja test ocupada', 'ACTIVA'),
     ($3, 'Caja test inactiva','INACTIVA')`,
    [CAJA_ACTIVA_LIBRE, CAJA_ACTIVA_OCUPADA, CAJA_INACTIVA]
  );

  await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, efectivo_inicial, estado)
     VALUES ('TUR-TEST-CAJA', $1, 'CAJ-TEST', 100, 'ABIERTO')`,
    [CAJA_ACTIVA_OCUPADA]
  );
});

test.after(async () => {
  await limpiar();
});

test("TDSI-464: caja ACTIVA sin turno abierto -> CERRADA", async () => {
  const r = await consultarEstadoCajas({ estado: "CERRADA" });
  const caja = r.cajas.find((c) => c.codigo === CAJA_ACTIVA_LIBRE);
  assert.ok(caja, "La caja activa libre debe aparecer como CERRADA");
  assert.equal(caja.estado, "CERRADA");
  assert.equal(caja.activa, true);
});

test("TDSI-464: caja ACTIVA con turno abierto -> ABIERTA", async () => {
  const r = await consultarEstadoCajas({ estado: "ABIERTA" });
  const caja = r.cajas.find((c) => c.codigo === CAJA_ACTIVA_OCUPADA);
  assert.ok(caja, "La caja activa con turno debe aparecer como ABIERTA");
  assert.equal(caja.estado, "ABIERTA");
  assert.equal(caja.activa, true);
});

test("TDSI-464: caja INACTIVA con turno abierto -> gana INACTIVA", async () => {
  const r = await consultarEstadoCajas({ estado: "INACTIVA" });
  const caja = r.cajas.find((c) => c.codigo === CAJA_INACTIVA);
  assert.ok(caja, "La caja inactiva debe aparecer como INACTIVA");
  assert.equal(caja.estado, "INACTIVA");
  assert.equal(caja.activa, false);
});

test("TDSI-465: filtro activa=true devuelve solo cajas ACTIVAS", async () => {
  const r = await consultarEstadoCajas({ activa: true });
  assert.ok(r.cajas.every((c) => c.activa === true), "Todas deben ser activas");
  assert.ok(r.cajas.some((c) => c.codigo === CAJA_ACTIVA_LIBRE));
  assert.ok(!r.cajas.some((c) => c.codigo === CAJA_INACTIVA));
});

test("TDSI-465: filtro activa=false devuelve solo cajas INACTIVAS", async () => {
  const r = await consultarEstadoCajas({ activa: false });
  assert.ok(r.cajas.every((c) => c.activa === false), "Todas deben ser inactivas");
  assert.ok(r.cajas.some((c) => c.codigo === CAJA_INACTIVA));
});

test("TDSI-465: filtro combinado estado=INACTIVA&activa=false", async () => {
  const r = await consultarEstadoCajas({ estado: "INACTIVA", activa: false });
  assert.ok(r.cajas.every((c) => c.estado === "INACTIVA" && c.activa === false));
});

test("TDSI-465: sin filtros devuelve al menos las 3 de prueba", async () => {
  const r = await consultarEstadoCajas();
  const codigos = r.cajas.map((c) => c.codigo);
  assert.ok(codigos.includes(CAJA_ACTIVA_LIBRE));
  assert.ok(codigos.includes(CAJA_ACTIVA_OCUPADA));
  assert.ok(codigos.includes(CAJA_INACTIVA));
});

test("TDSI-465: filtro 'estado' invalido lanza 400", async () => {
  await assert.rejects(
    () => consultarEstadoCajas({ estado: "NO_EXISTE" }),
    (e) => e.status === 400
  );
});