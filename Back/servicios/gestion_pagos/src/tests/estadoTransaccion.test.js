const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { consultarEstado, actualizarEstado, consultarHistorial } = require("../services/transaccionesEstadoService");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TX_PENDIENTE = "TEST-TDSI14-PENDIENTE";
const TX_APROBADA  = "TEST-TDSI14-APROBADA";
const TX_HISTORIAL = "TEST-TDSI14-HISTORIAL";
const TX_INEXISTENTE = "TEST-TDSI14-NO-EXISTE";

async function limpiarTodo() {
  await query(
    `DELETE FROM pagos.historial_estados_transaccion
     WHERE id_transaccion LIKE 'TEST-TDSI14-%'`
  );
  await query(
    `DELETE FROM pagos.transacciones
     WHERE id_transaccion LIKE 'TEST-TDSI14-%'`
  );
}

/** Borra solo una transaccion y su historial (para los finally) */
async function limpiarUno(idTransaccion) {
  await query(
    `DELETE FROM pagos.historial_estados_transaccion WHERE id_transaccion = $1`,
    [idTransaccion]
  );
  await query(
    `DELETE FROM pagos.transacciones WHERE id_transaccion = $1`,
    [idTransaccion]
  );
}

async function crearTransaccion(idTransaccion, estadoPago = "PENDIENTE") {
  const { rows } = await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, estado_pago)
     VALUES ($1, 'Efectivo', 100, 'Simple', $2)
     RETURNING id`,
    [idTransaccion, estadoPago]
  );
  return rows[0].id;
}

test.before(async () => {
  await limpiarTodo();
  await crearTransaccion(TX_PENDIENTE, "PENDIENTE");
  await crearTransaccion(TX_APROBADA, "APROBADA");
});

test.after(async () => {
  await limpiarTodo();
});

// ---------------------------------------------------------------------------
// TDSI-359: consultar estado
// ---------------------------------------------------------------------------

test("TDSI-359: consultarEstado retorna el estado_pago de una transaccion existente", async () => {
  const r = await consultarEstado(TX_PENDIENTE);
  assert.equal(r.id_transaccion, TX_PENDIENTE);
  assert.equal(r.estado_pago, "PENDIENTE");
  assert.ok(r.actualizado_en);
});

test("TDSI-359: consultarEstado lanza 404 si el id_transaccion no existe", async () => {
  await assert.rejects(
    () => consultarEstado(TX_INEXISTENTE),
    (e) => e.status === 404
  );
});

test("TDSI-359: consultarEstado lanza 400 si el id tiene formato invalido", async () => {
  await assert.rejects(() => consultarEstado(""), (e) => e.status === 400);
  await assert.rejects(() => consultarEstado("abc con espacios"), (e) => e.status === 400);
  await assert.rejects(() => consultarEstado("a".repeat(61)), (e) => e.status === 400);
});

// ---------------------------------------------------------------------------
// TDSI-360: actualizar estado
// ---------------------------------------------------------------------------

test("TDSI-360: actualizarEstado cambia PENDIENTE -> APROBADA", async () => {
  const r = await actualizarEstado(TX_PENDIENTE, {
    estado: "APROBADA",
    motivo: "Pago confirmado",
  });
  assert.equal(r.estado_pago, "APROBADA");
  assert.equal(r.estado_anterior, "PENDIENTE");
});

test("TDSI-360: actualizarEstado acepta el estado en minusculas (normaliza a mayusculas)", async () => {
  await crearTransaccion("TEST-TDSI14-CASE", "PENDIENTE");
  try {
    const r = await actualizarEstado("TEST-TDSI14-CASE", { estado: "aprobada" });
    assert.equal(r.estado_pago, "APROBADA");
  } finally {
    await limpiarUno("TEST-TDSI14-CASE");
  }
});

test("TDSI-360: actualizarEstado lanza 400 con estado invalido", async () => {
  await assert.rejects(
    () => actualizarEstado(TX_PENDIENTE, { estado: "CANCELADA" }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => actualizarEstado(TX_PENDIENTE, {}),
    (e) => e.status === 400
  );
});

test("TDSI-360: actualizarEstado lanza 409 al intentar cambiar un estado final", async () => {
  await assert.rejects(
    () => actualizarEstado(TX_APROBADA, { estado: "RECHAZADA" }),
    (e) => e.status === 409
  );
});

test("TDSI-360: actualizarEstado lanza 404 si la transaccion no existe", async () => {
  await assert.rejects(
    () => actualizarEstado(TX_INEXISTENTE, { estado: "APROBADA" }),
    (e) => e.status === 404
  );
});

test("TDSI-360: actualizarEstado lanza 400 si el motivo supera 200 caracteres", async () => {
  await crearTransaccion("TEST-TDSI14-MOTIVO", "PENDIENTE");
  try {
    await assert.rejects(
      () => actualizarEstado("TEST-TDSI14-MOTIVO", { estado: "APROBADA", motivo: "x".repeat(201) }),
      (e) => e.status === 400
    );
  } finally {
    await limpiarUno("TEST-TDSI14-MOTIVO");
  }
});

// ---------------------------------------------------------------------------
// TDSI-361: historial
// ---------------------------------------------------------------------------

test("TDSI-361: consultarHistorial retorna los cambios ordenados por fecha descendente", async () => {
  await crearTransaccion(TX_HISTORIAL, "PENDIENTE");
  try {
    await actualizarEstado(TX_HISTORIAL, { estado: "APROBADA", motivo: "Primer cambio" });

    const historial = await consultarHistorial(TX_HISTORIAL);
    assert.equal(historial.length, 1);
    assert.equal(historial[0].estado_anterior, "PENDIENTE");
    assert.equal(historial[0].estado_nuevo, "APROBADA");
    assert.equal(historial[0].motivo, "Primer cambio");
    assert.equal(historial[0].origen, "SISTEMA");
  } finally {
    await limpiarUno(TX_HISTORIAL);
  }
});

test("TDSI-361: consultarHistorial lanza 404 si la transaccion no existe", async () => {
  await assert.rejects(
    () => consultarHistorial(TX_INEXISTENTE),
    (e) => e.status === 404
  );
});

test("TDSI-361: consultarHistorial lanza 400 si el id es invalido", async () => {
  await assert.rejects(() => consultarHistorial(""), (e) => e.status === 400);
});

// ---------------------------------------------------------------------------
// TDSI-360 + TDSI-361: rollback
// ---------------------------------------------------------------------------

test("TDSI-360/361: si el cambio falla con 409, el historial NO crece (rollback)", async () => {
  await crearTransaccion("TEST-TDSI14-ROLLBACK", "APROBADA");
  try {
    const antes = await query(
      `SELECT count(*)::int AS n FROM pagos.historial_estados_transaccion WHERE id_transaccion = $1`,
      ["TEST-TDSI14-ROLLBACK"]
    );
    assert.equal(antes.rows[0].n, 0);

    await assert.rejects(
      () => actualizarEstado("TEST-TDSI14-ROLLBACK", { estado: "RECHAZADA" }),
      (e) => e.status === 409
    );

    const despues = await query(
      `SELECT count(*)::int AS n FROM pagos.historial_estados_transaccion WHERE id_transaccion = $1`,
      ["TEST-TDSI14-ROLLBACK"]
    );
    assert.equal(despues.rows[0].n, 0, "El historial NO debe haber crecido");
  } finally {
    await limpiarUno("TEST-TDSI14-ROLLBACK");
  }
});

// ---------------------------------------------------------------------------
// TDSI-362: cache
// ---------------------------------------------------------------------------

test("TDSI-362: la segunda consulta seguida usa cache (mismo actualizado_en)", async () => {
  await crearTransaccion("TEST-TDSI14-CACHE", "PENDIENTE");
  try {
    const r1 = await consultarEstado("TEST-TDSI14-CACHE");
    const r2 = await consultarEstado("TEST-TDSI14-CACHE");
    assert.equal(r1.actualizado_en, r2.actualizado_en, "La segunda llamada debe devolver el mismo objeto cacheado");
  } finally {
    await limpiarUno("TEST-TDSI14-CACHE");
  }
});

test("TDSI-362: actualizarEstado invalida el cache", async () => {
  await crearTransaccion("TEST-TDSI14-INVALIDA", "PENDIENTE");
  try {
    const r1 = await consultarEstado("TEST-TDSI14-INVALIDA");
    assert.equal(r1.estado_pago, "PENDIENTE");

    await actualizarEstado("TEST-TDSI14-INVALIDA", { estado: "APROBADA" });

    const r2 = await consultarEstado("TEST-TDSI14-INVALIDA");
    assert.equal(r2.estado_pago, "APROBADA");
  } finally {
    await limpiarUno("TEST-TDSI14-INVALIDA");
  }
});