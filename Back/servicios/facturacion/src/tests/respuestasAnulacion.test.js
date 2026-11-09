const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const service = require("../services/respuestasAnulacionService");

const CAJERO_ID = "CAJERO-TEST-TDSI48";
const OTRO_CAJERO = "OTRO-CAJERO";

async function limpiar() {
  await query(`DELETE FROM facturacion.respuestas_anulacion WHERE cajero_id IN ($1, $2)`, [CAJERO_ID, OTRO_CAJERO]);
}

test.beforeEach(limpiar);
test.after(limpiar);

test("TDSI-891: crea una respuesta válida (10+ caracteres)", async () => {
  const res = await service.crear({
    cajero_id: CAJERO_ID,
    texto: "El cliente no estaba conforme con el producto",
  });
  assert.equal(res.cajero_id, CAJERO_ID);
  assert.equal(res.texto, "El cliente no estaba conforme con el producto");
  assert.ok(res.id);
});

test("TDSI-891: rechaza texto con menos de 10 caracteres", async () => {
  await assert.rejects(
    () => service.crear({ cajero_id: CAJERO_ID, texto: "Muy corto" }),
    (e) => e.status === 400 && e.message.includes("10 y 100")
  );
});

test("TDSI-891: rechaza texto con más de 100 caracteres", async () => {
  const textoLargo = "a".repeat(101);
  await assert.rejects(
    () => service.crear({ cajero_id: CAJERO_ID, texto: textoLargo }),
    (e) => e.status === 400 && e.message.includes("10 y 100")
  );
});

test("TDSI-891: no deja crear una novena respuesta (máximo 8 por cajero)", async () => {
  for (let i = 1; i <= 8; i++) {
    await service.crear({ cajero_id: CAJERO_ID, texto: `Motivo numero ${i} del cajero` });
  }
  await assert.rejects(
    () => service.crear({ cajero_id: CAJERO_ID, texto: "Este seria el noveno motivo" }),
    (e) => e.status === 409
  );

  // el limite es por cajero: otro cajero sigue pudiendo crear las suyas
  const deOtro = await service.crear({ cajero_id: OTRO_CAJERO, texto: "Motivo del otro cajero" });
  assert.ok(deOtro.id);
});

test("TDSI-892: no permite editar la respuesta de otro cajero", async () => {
  const res = await service.crear({
    cajero_id: CAJERO_ID,
    texto: "Motivo original del cajero 1",
  });

  await assert.rejects(
    () => service.actualizar(res.id, OTRO_CAJERO, { texto: "Intento de cambio no autorizado" }),
    (e) => e.status === 403
  );
});

test("TDSI-892: no permite eliminar la respuesta de otro cajero", async () => {
  const res = await service.crear({
    cajero_id: CAJERO_ID,
    texto: "Motivo para borrar",
  });

  await assert.rejects(
    () => service.eliminar(res.id, OTRO_CAJERO),
    (e) => e.status === 403
  );
});

test("TDSI-890: lista solo las respuestas del cajero", async () => {
  await service.crear({ cajero_id: CAJERO_ID, texto: "Motivo del cajero 1" });
  await service.crear({ cajero_id: OTRO_CAJERO, texto: "Motivo del cajero 2" });

  const lista = await service.listar(CAJERO_ID);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].texto, "Motivo del cajero 1");
});