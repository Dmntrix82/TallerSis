const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { abrirTurno } = require("../services/turnosService");

const CAJA_A = "CAJA-TEST-313";
const CAJA_B = "CAJA-TEST-313-B";

test.before(async () => {
  // Crear cajas de prueba (idempotente)
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, 'Caja Test 313', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_A]
  );
  await query(
    `INSERT INTO caja.cajas (codigo, nombre, estado)
     VALUES ($1, 'Caja Test 313 B', 'ACTIVA')
     ON CONFLICT (codigo) DO NOTHING`,
    [CAJA_B]
  );

  // Limpiar turnos residuales de corridas anteriores
  await query(`DELETE FROM caja.turnos WHERE caja_id IN ($1, $2)`, [CAJA_A, CAJA_B]);

  // Dejar CAJA_A ocupada con un turno abierto
  await abrirTurno({
    caja_id: CAJA_A,
    cajero_id: "CAJ-TEST-313",
    efectivo_inicial: 100,
  });
});

test.after(async () => {
  await query(`DELETE FROM caja.turnos WHERE caja_id IN ($1, $2)`, [CAJA_A, CAJA_B]);
  await query(`DELETE FROM caja.cajas  WHERE codigo  IN ($1, $2)`, [CAJA_A, CAJA_B]);
});

test("TDSI-313: rechaza abrir un turno si ya hay uno abierto en la misma caja", async () => {
  await assert.rejects(
    () => abrirTurno({
      caja_id: CAJA_A,
      cajero_id: "CAJ-TEST-313-B",
      efectivo_inicial: 50,
    }),
    (e) => e.status === 409 && /turno abierto/i.test(e.message)
  );
});

test("TDSI-313: el error 409 incluye el codigo del turno abierto", async () => {
  try {
    await abrirTurno({
      caja_id: CAJA_A,
      cajero_id: "CAJ-TEST-313-C",
      efectivo_inicial: 50,
    });
    assert.fail("Debió lanzar 409");
  } catch (e) {
    assert.equal(e.status, 409);
    assert.ok(e.detalle);
    assert.equal(e.detalle.caja_id, CAJA_A);
    assert.match(e.detalle.turno_abierto, /^TUR-\d{6}$/);
  }
});

test("TDSI-313: permite abrir en otra caja aunque haya una ocupada", async () => {
  const t = await abrirTurno({
    caja_id: CAJA_B,
    cajero_id: "CAJ-TEST-313-D",
    efectivo_inicial: 25,
  });
  assert.ok(t.codigo);
  assert.equal(t.estado, "ABIERTO");
  assert.equal(t.caja_id, CAJA_B);
});