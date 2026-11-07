// TDSI-60: si gestion_pagos no responde al cerrar, el cierre falla sin dejar el arqueo
// guardado. Este archivo apunta GESTION_PAGOS_URL a un puerto cerrado ANTES de cargar
// cierreService (pagosProxy lee la URL al cargarse), por eso va separado de arqueo.test.js.
process.env.GESTION_PAGOS_URL = "http://127.0.0.1:9";

const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { cerrarTurno } = require("../services/cierreService");
const arqueoRepo = require("../data/arqueoRepo");

const SUFIJO = Date.now();
let turnoId;

test.before(async () => {
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial)
     VALUES ($1, 'CAJA-ARQ-FALLA', 'U-ARQ', 'Cajero Arqueo', 100) RETURNING id`,
    [`T-ARQF-${SUFIJO}`.slice(0, 20)]
  );
  turnoId = rows[0].id;
});

test.after(async () => {
  await query("DELETE FROM caja.turnos WHERE id = $1", [turnoId]);
  await pool.end();
});

test("TDSI-60: con gestion_pagos caido el cierre falla y no queda arqueo guardado", async () => {
  await assert.rejects(
    () => cerrarTurno(turnoId, { supervisor_id: "SUP-TEST", pin: "1234", arqueo: [{ denominacion: 100, cantidad: 2 }] }),
    { status: 502 }
  );
  const { rows } = await query("SELECT estado FROM caja.turnos WHERE id = $1", [turnoId]);
  assert.equal(rows[0].estado, "ABIERTO");
  assert.deepEqual(await arqueoRepo.listarPorTurno(turnoId), []);
});
