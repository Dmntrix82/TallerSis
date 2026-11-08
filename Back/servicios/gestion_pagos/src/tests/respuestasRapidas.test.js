// TDSI-44/799/800/801: CRUD de "Mis respuestas rápidas" -- cada cajero ve y
// administra solo las suyas, texto de 5 a 100 caracteres, maximo 8 por cajero.
// BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { listar, crear, actualizar, eliminar } = require("../services/respuestasRapidasService");
const { query } = require("../config/db");

const CAJERO = `cajero-tdsi44-${Date.now()}`;
const OTRO_CAJERO = `otro-cajero-tdsi44-${Date.now()}`;

test.after(async () => {
  await query(`DELETE FROM pagos.respuestas_rapidas WHERE cajero_id = ANY($1)`, [[CAJERO, OTRO_CAJERO]]);
});

test("TDSI-799/800: crea y lista las respuestas de un cajero", async () => {
  await crear({ cajero_id: CAJERO, texto: "El cliente olvidó su billetera" });
  const r = await listar(CAJERO);
  assert.equal(r.length, 1);
  assert.equal(r[0].texto, "El cliente olvidó su billetera");
  assert.equal(r[0].cajero_id, CAJERO);
});

test("TDSI-800: rechaza un texto de menos de 5 caracteres", async () => {
  await assert.rejects(() => crear({ cajero_id: CAJERO, texto: "Hola" }), (e) => e.status === 400);
});

test("TDSI-800: rechaza un texto de más de 100 caracteres", async () => {
  await assert.rejects(() => crear({ cajero_id: CAJERO, texto: "x".repeat(101) }), (e) => e.status === 400);
});

test("TDSI-800: no deja crear una novena respuesta (máximo 8 por cajero)", async () => {
  const CAJERO_LLENO = `${CAJERO}-lleno`;
  await query(`DELETE FROM pagos.respuestas_rapidas WHERE cajero_id = $1`, [CAJERO_LLENO]);
  try {
    for (let i = 1; i <= 8; i++) {
      await crear({ cajero_id: CAJERO_LLENO, texto: `Respuesta numero ${i} de prueba` });
    }
    await assert.rejects(
      () => crear({ cajero_id: CAJERO_LLENO, texto: "La respuesta numero nueve" }),
      (e) => e.status === 409
    );
    const r = await listar(CAJERO_LLENO);
    assert.equal(r.length, 8);
  } finally {
    await query(`DELETE FROM pagos.respuestas_rapidas WHERE cajero_id = $1`, [CAJERO_LLENO]);
  }
});

test("TDSI-801: un cajero no puede editar ni eliminar la respuesta de otro cajero", async () => {
  const propia = await crear({ cajero_id: CAJERO, texto: "Respuesta solo mia, nadie mas" });

  await assert.rejects(
    () => actualizar(propia.id, OTRO_CAJERO, { texto: "Intento de edicion ajena" }),
    (e) => e.status === 403
  );
  await assert.rejects(
    () => eliminar(propia.id, OTRO_CAJERO),
    (e) => e.status === 403
  );

  const sigueIgual = await listar(CAJERO);
  assert.ok(sigueIgual.some((r) => r.id === propia.id && r.texto === "Respuesta solo mia, nadie mas"));
});

test("TDSI-800/801: el dueño sí puede editar y eliminar su propia respuesta", async () => {
  const propia = await crear({ cajero_id: CAJERO, texto: "Respuesta para editar y borrar" });

  const editada = await actualizar(propia.id, CAJERO, { texto: "Respuesta ya editada por su dueño" });
  assert.equal(editada.texto, "Respuesta ya editada por su dueño");

  const r = await eliminar(propia.id, CAJERO);
  assert.equal(r.eliminado, true);

  const lista = await listar(CAJERO);
  assert.ok(!lista.some((x) => x.id === propia.id));
});

test("TDSI-799: un cajero no ve las respuestas de otro", async () => {
  await crear({ cajero_id: OTRO_CAJERO, texto: "Respuesta que es de otro cajero" });
  const propias = await listar(CAJERO);
  assert.ok(!propias.some((r) => r.cajero_id === OTRO_CAJERO));
});
