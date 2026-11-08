// TDSI-49/932: lista de facturas anuladas del turno, para "Ver anuladas" del cierre de
// caja. BD real + gestion_pagos (GESTION_PAGOS_URL) para las ventas; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { listarAnuladas, generarReporteCierre, generarReporteTexto } = require("../services/cierreService");

const CAJA = "CAJA-TEST-932";
// Dia fijo + turnos sin solapar en el tiempo (igual que reportes.test.js): la lista
// de anuladas filtra por caja_id + rango de fechas, asi que dos turnos de la misma
// caja con ventanas solapadas se mezclarian entre si -- igual que pasaria en produccion
// si dos turnos de la misma caja se superpusieran (algo que el sistema no permite).
const DIA = "2021-05-10";
const en = (hora) => `${DIA} ${hora}-04`;
let turnoConAnuladas, turnoSinAnuladas;
let servidor, base;

async function limpiar() {
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

async function turno(codigo, abierto, cerrado) {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, estado, abierto_en, cerrado_en)
     VALUES ($1, $2, 'CAJ-932', 'Cajero 932', 100, 'CERRADO', $3, $4) RETURNING id`,
    [codigo, CAJA, en(abierto), en(cerrado)]
  );
  return Number(rows[0].id);
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 932', 'ACTIVA')`, [CAJA]);

  // Turno 1 (08:00-12:00): una venta registrada y una anulada
  turnoConAnuladas = await turno("TUR-932-1", "08:00", "12:00");
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha)
     VALUES ('VTA-932-1', 'Efectivo', 120, 'Simple', $1, 'Registrado', $2)`,
    [CAJA, en("09:00")]
  );
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha, motivo_anulacion, anulado_por, anulado_por_nombre, anulado_en)
     VALUES ('VTA-932-2', 'QR', 45, 'Simple', $1, 'Anulado', $2, 'El cliente se arrepintio', 'SUP-TEST', 'Supervisor Prueba', $2)`,
    [CAJA, en("10:00")]
  );

  // Turno 2 (14:00-18:00): solo una venta registrada, sin anulaciones
  turnoSinAnuladas = await turno("TUR-932-2", "14:00", "18:00");
  await query(
    `INSERT INTO pagos.transacciones
       (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha)
     VALUES ('VTA-932-3', 'Tarjeta', 70, 'Simple', $1, 'Registrado', $2)`,
    [CAJA, en("15:00")]
  );

  const app = express();
  app.use(express.json());
  app.use("/api/caja", require("../routes/turnosRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/caja`;
});

test.after(async () => {
  servidor.close();
  await limpiar();
});

test("TDSI-175/929/930: un turno con anulaciones trae la lista, el motivo, el supervisor y la suma", async () => {
  const r = await listarAnuladas(turnoConAnuladas);
  assert.equal(r.caja_id, CAJA);
  assert.equal(r.cantidadAnuladas, 1);
  assert.equal(r.montoAnulado, 45);
  assert.equal(r.anuladas.length, 1);
  assert.deepEqual(
    [r.anuladas[0].numero_factura, r.anuladas[0].total, r.anuladas[0].motivo, r.anuladas[0].supervisor],
    ["VTA-932-2", 45, "El cliente se arrepintio", "Supervisor Prueba"]
  );
});

test("TDSI-175: un turno sin anulaciones trae la lista vacia", async () => {
  const r = await listarAnuladas(turnoSinAnuladas);
  assert.equal(r.cantidadAnuladas, 0);
  assert.equal(r.montoAnulado, 0);
  assert.deepEqual(r.anuladas, []);
});

test("TDSI-175: lanza 404 si el turno no existe", async () => {
  await assert.rejects(() => listarAnuladas(999999999), (e) => e.status === 404);
});

test("TDSI-931: el reporte de cierre y su version en texto incluyen el detalle de las anuladas", async () => {
  const reporte = await generarReporteCierre(turnoConAnuladas);
  assert.equal(reporte.anuladas.length, 1);
  assert.equal(reporte.anuladas[0].numero_factura, "VTA-932-2");

  const texto = await generarReporteTexto(turnoSinAnuladas);
  assert.ok(!texto.includes("FACTURAS ANULADAS"), "un turno sin anulaciones no debe mostrar la seccion");

  const textoConAnuladas = await generarReporteTexto(turnoConAnuladas);
  assert.match(textoConAnuladas, /FACTURAS ANULADAS/);
  assert.match(textoConAnuladas, /VTA-932-2/);
  assert.match(textoConAnuladas, /El cliente se arrepintio/);
  assert.match(textoConAnuladas, /Supervisor Prueba/);
});

test("TDSI-175: GET /api/caja/turnos/:turnoId/anuladas", async () => {
  const con = await fetch(`${base}/turnos/${turnoConAnuladas}/anuladas`);
  assert.equal(con.status, 200);
  const cuerpoCon = await con.json();
  assert.equal(cuerpoCon.ok, true);
  assert.equal(cuerpoCon.data.cantidadAnuladas, 1);
  assert.equal(cuerpoCon.data.montoAnulado, 45);

  const sin = await fetch(`${base}/turnos/${turnoSinAnuladas}/anuladas`);
  const cuerpoSin = await sin.json();
  assert.deepEqual(cuerpoSin.data.anuladas, []);

  const noExiste = await fetch(`${base}/turnos/999999999/anuladas`);
  assert.equal(noExiste.status, 404);
});
