const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { registrarMovimiento } = require("../services/movimientoService");
const { cerrarTurno } = require("../services/cierreService");

let turnoId;

test.before(async () => {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ('TURNO-TEST-322', 'CAJA-TEST-322', 'U-2', 'Luis Mamani', 100)
     RETURNING id`
  );
  turnoId = rows[0].id;
});

test.after(async () => {
  await query(`DELETE FROM caja.turnos WHERE id = $1`, [turnoId]);
});

test("TDSI-322: permite registrar un movimiento mientras el turno esta abierto", async () => {
  const m = await registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "Efectivo", monto: 80, descripcion: "Venta prueba" });
  assert.equal(Number(m.monto), 80);
  assert.equal(m.tipo, "INGRESO");
});

test("TDSI-322: rechaza un monto invalido", async () => {
  await assert.rejects(
    () => registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "Efectivo", monto: -5 }),
    (e) => e.status === 400
  );
});

test("TDSI-322: cierra el turno y guarda el arqueo", async () => {
  const r = await cerrarTurno(turnoId, 180); // 100 inicial + 80 efectivo = 180 esperado
  assert.equal(r.turno.estado, "CERRADO");
  assert.equal(Number(r.turno.diferencia), 0);
  assert.equal(r.reporte.arqueoEfectivo.tipoDiferencia, "CUADRA");
});

test("TDSI-322: bloquea nuevos movimientos despues del cierre", async () => {
  await assert.rejects(
    () => registrarMovimiento(turnoId, { tipo: "INGRESO", metodo: "QR", monto: 20 }),
    (e) => e.status === 423
  );
});

test("TDSI-322: no permite cerrar un turno ya cerrado", async () => {
  await assert.rejects(() => cerrarTurno(turnoId, 180), (e) => e.status === 409);
});