// TDSI-32: gestion de diferencias de caja (faltantes / sobrantes). BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { cerrarTurno } = require("../services/cierreService");
const diferencias = require("../services/diferenciaService");

const CAJA = "CAJA-TEST-DIF-1";
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
let difFaltante;

async function limpiar() {
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]); // diferencias_resolucion se borra en cascada
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

async function turnoAbierto(codigo, inicial) {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ($1, $2, 'CAJ-DIF', 'Cajero Diferencias', $3) RETURNING id`,
    [codigo, CAJA, inicial]
  );
  return Number(rows[0].id);
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test Dif', 'ACTIVA')`, [CAJA]);
});
test.after(limpiar);

test("TDSI-487: cerrar con faltante o sobrante registra la diferencia; si cuadra, no", async () => {
  const t1 = await turnoAbierto("TUR-DIF-1", 100);
  const r1 = await cerrarTurno(t1, { ...SUPERVISOR, efectivo_contado: 70 });
  assert.equal(r1.turno.tipo_diferencia, "FALTANTE");

  const t2 = await turnoAbierto("TUR-DIF-2", 50);
  await cerrarTurno(t2, { ...SUPERVISOR, efectivo_contado: 55.5 });

  const t3 = await turnoAbierto("TUR-DIF-3", 40);
  await cerrarTurno(t3, { ...SUPERVISOR, efectivo_contado: 40 });

  const lista = await diferencias.listar({ caja_id: CAJA });
  assert.deepEqual(lista.map((d) => [d.turno_id, d.tipo, d.monto, d.estado]), [
    [t2, "SOBRANTE", 5.5, "PENDIENTE"],
    [t1, "FALTANTE", -30, "PENDIENTE"],
  ]);
  difFaltante = lista.find((d) => d.tipo === "FALTANTE").id;
});

test("TDSI-489: filtra por estado, tipo y caja; rechaza filtros invalidos", async () => {
  assert.equal((await diferencias.listar({ caja_id: CAJA, tipo: "FALTANTE" })).length, 1);
  assert.equal((await diferencias.listar({ caja_id: CAJA, estado: "RESUELTA" })).length, 0);
  assert.equal((await diferencias.listar({ caja_id: "CAJA-NO-EXISTE" })).length, 0);
  await assert.rejects(() => diferencias.listar({ estado: "CERRADA" }), (e) => e.status === 400);
  await assert.rejects(() => diferencias.listar({ tipo: "CUADRA" }), (e) => e.status === 400);
});

test("TDSI-488: resolver exige justificacion y responsable, y queda RESUELTA con fecha", async () => {
  await assert.rejects(() => diferencias.resolver(difFaltante, { resuelta_por: "SUP-TEST" }), (e) => e.status === 400);
  await assert.rejects(() => diferencias.resolver(difFaltante, { justificacion: "  ", resuelta_por: "SUP-TEST" }), (e) => e.status === 400);
  await assert.rejects(() => diferencias.resolver(difFaltante, { justificacion: "Error de vuelto" }), (e) => e.status === 400);
  await assert.rejects(() => diferencias.resolver("abc", { justificacion: "x", resuelta_por: "y" }), (e) => e.status === 400);
  await assert.rejects(() => diferencias.resolver(999999999, { justificacion: "x", resuelta_por: "y" }), (e) => e.status === 404);

  const r = await diferencias.resolver(difFaltante, { justificacion: " Error de vuelto en la venta 15 ", resuelta_por: "SUP-TEST" });
  assert.equal(r.estado, "RESUELTA");
  assert.equal(r.justificacion, "Error de vuelto en la venta 15");
  assert.equal(r.resuelta_por, "SUP-TEST");
  assert.ok(r.resuelta_en);

  await assert.rejects(
    () => diferencias.resolver(difFaltante, { justificacion: "otra vez", resuelta_por: "SUP-TEST" }),
    (e) => e.status === 409
  );
  assert.equal((await diferencias.listar({ caja_id: CAJA, estado: "RESUELTA" })).length, 1);
  assert.equal((await diferencias.listar({ caja_id: CAJA, estado: "PENDIENTE" })).length, 1);
});
