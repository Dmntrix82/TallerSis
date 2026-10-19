// TDSI-31: comparacion de monto registrado (esperado) vs monto disponible (contado).
// Usa la BD real y gestion_pagos (GESTION_PAGOS_URL) para las ventas; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { listarComparacion } = require("../services/comparacionService");
const autorizaciones = require("../services/autorizacionService");
const { hoyLocal } = require("../utils/fechas");

const SUF = Date.now();
const CAJERO = `cajero.comp.${SUF}`;
const CAJAS = ["CAJA-CMP-A", "CAJA-CMP-B", "CAJA-CMP-C", "CAJA-CMP-D"];
const SUPERVISOR = { supervisor_id: "SUP-TEST", pin: "1234" };
const HOY = hoyLocal();
const turnos = {};

async function limpiar() {
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'CMP-%'`);
  await query(`DELETE FROM caja.autorizaciones WHERE caja_id = ANY($1)`, [CAJAS]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = ANY($1)`, [CAJAS]);
  await query(`DELETE FROM caja.cajas WHERE codigo = ANY($1)`, [CAJAS]);
}

async function abrirTurno(caja, inicial, extra = "") {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial ${extra ? ", estado, cerrado_en" : ""})
     VALUES ($1, $2, $3, 'Cajero Comparacion', $4 ${extra ? ", 'CERRADO', now()" : ""}) RETURNING id`,
    [`TUR-${caja}`, caja, CAJERO, inicial]
  );
  return Number(rows[0].id);
}

test.before(async () => {
  await limpiar();
  for (const c of CAJAS) {
    await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, $1, 'ACTIVA')`, [c]);
  }
  // A: inicial 100 + venta en efectivo 50; el cajero cuenta 140 y el supervisor aprueba -> FALTANTE -10
  turnos.A = await abrirTurno("CAJA-CMP-A", 100);
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, caja_id, estado, fecha)
     VALUES ('CMP-A-1', 'Efectivo', 50, 'Simple', 'CAJA-CMP-A', 'Registrado', now() + interval '1 second')`
  );
  await new Promise((r) => setTimeout(r, 1100));
  const sA = await autorizaciones.solicitarCierre({ turno_id: turnos.A, cajero_id: CAJERO, efectivo_contado: 140 });
  await autorizaciones.aprobarSolicitud(sA.id, SUPERVISOR);

  // B: abierto con 30, nadie conto todavia -> SIN_ARQUEO (esperado 30, sin contado)
  turnos.B = await abrirTurno("CAJA-CMP-B", 30);

  // C: abierto con 20 y una solicitud de cierre pendiente contando 25 -> SOBRANTE +5
  turnos.C = await abrirTurno("CAJA-CMP-C", 20);
  await autorizaciones.solicitarCierre({ turno_id: turnos.C, cajero_id: CAJERO, efectivo_contado: 25 });

  // D: cerrado antes del arreglo (sin arqueo guardado) pero con su solicitud aprobada contando 60 -> CUADRA
  turnos.D = await abrirTurno("CAJA-CMP-D", 60, "cerrado");
  await query(
    `INSERT INTO caja.autorizaciones (tipo, caja_id, turno_id, cajero_id, efectivo_contado, solicitado_por, estado)
     VALUES ('CIERRE', 'CAJA-CMP-D', $1, $2, 60, $2, 'APROBADA')`,
    [turnos.D, CAJERO]
  );
});

test.after(limpiar);

const porCaja = (r) => Object.fromEntries(r.turnos.map((t) => [t.caja_id, t]));

test("TDSI-483/484: cada turno con su monto registrado (esperado) y disponible (contado)", async () => {
  const r = await listarComparacion({ fecha: HOY, cajero_id: CAJERO });
  assert.equal(r.filtros.fecha, HOY);
  const t = porCaja(r);
  const resumen = (x) => [x.estado, x.efectivo_esperado, x.efectivo_contado, x.diferencia, x.tipo_diferencia, x.fuente_contado];

  assert.deepEqual(resumen(t["CAJA-CMP-A"]), ["CERRADO", 150, 140, -10, "FALTANTE", "CIERRE"]);
  assert.deepEqual(resumen(t["CAJA-CMP-B"]), ["ABIERTO", 30, null, null, "SIN_ARQUEO", null]);
  assert.deepEqual(resumen(t["CAJA-CMP-C"]), ["ABIERTO", 20, 25, 5, "SOBRANTE", "SOLICITUD_PENDIENTE"]);
  assert.deepEqual(resumen(t["CAJA-CMP-D"]), ["CERRADO", 60, 60, 0, "CUADRA", "SOLICITUD_APROBADA"]);
});

test("TDSI-486: resumen de cuantos cuadran, faltantes, sobrantes y sin arqueo", async () => {
  const r = await listarComparacion({ fecha: HOY, cajero_id: CAJERO });
  assert.deepEqual(r.resumen, { total: 4, cuadran: 1, faltantes: 1, sobrantes: 1, sin_arqueo: 1 });
});

test("TDSI-485: filtros por caja, cajero y tipo de diferencia", async () => {
  const faltantes = await listarComparacion({ fecha: HOY, cajero_id: CAJERO, tipo_diferencia: "faltante" });
  assert.equal(faltantes.filtros.tipo, "FALTANTE");
  assert.deepEqual(faltantes.turnos.map((t) => t.caja_id), ["CAJA-CMP-A"]);
  assert.deepEqual(faltantes.resumen, { total: 1, cuadran: 0, faltantes: 1, sobrantes: 0, sin_arqueo: 0 });

  const cajaC = await listarComparacion({ fecha: HOY, caja_id: "CAJA-CMP-C" });
  assert.deepEqual(cajaC.turnos.map((t) => t.turno_id), [turnos.C]);

  const otroDia = await listarComparacion({ fecha: "2021-01-01", cajero_id: CAJERO });
  assert.equal(otroDia.resumen.total, 0);
});

test("TDSI-487: al aprobar el cierre con faltante queda registrada la diferencia", async () => {
  const { rows } = await query(
    `SELECT tipo, monto, estado FROM caja.diferencias_resolucion WHERE turno_id = $1`,
    [turnos.A]
  );
  assert.deepEqual(rows.map((d) => [d.tipo, Number(d.monto), d.estado]), [["FALTANTE", -10, "PENDIENTE"]]);
});

test("TDSI-485: rechaza fecha o tipo invalidos con 400", async () => {
  for (const filtros of [{ fecha: "abc" }, { fecha: "2026-02-30" }, { fecha: HOY, tipo_diferencia: "XYZ" }]) {
    await assert.rejects(() => listarComparacion(filtros), (e) => e.status === 400, JSON.stringify(filtros));
  }
});
