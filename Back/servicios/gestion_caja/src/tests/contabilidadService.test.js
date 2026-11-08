// TDSI-52: arma el mensaje "diferencia_caja" en el formato que ya acepta Contabilidad.
// BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query } = require("../config/db");
const { armarMensajeDiferencia } = require("../services/contabilidadService");

const CAJA = "CAJA-TEST-52";
const DIA = "2021-08-10";
const en = (hora) => `${DIA} ${hora}-04`;

async function limpiar() {
  await query(`DELETE FROM caja.diferencias_resolucion WHERE turno_id IN (SELECT id FROM caja.turnos WHERE caja_id = $1)`, [CAJA]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM caja.cajas WHERE codigo = $1`, [CAJA]);
}

let contadorTurnos = 0;

async function turnoCerrado({ cajeroNombre = "Ana Quispe", abierto = "08:00", cerrado = "12:00" } = {}) {
  contadorTurnos += 1;
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, estado, abierto_en, cerrado_en)
     VALUES ($1, $2, 'CAJ-52', $3, 100, 'CERRADO', $4, $5) RETURNING *`,
    [`TUR-TEST-52-${contadorTurnos}`, CAJA, cajeroNombre, en(abierto), en(cerrado)]
  );
  return rows[0];
}

async function diferencia({ turnoId, tipo = "FALTANTE", monto = 15.5, justificacion = "Error al dar vuelto" }) {
  const { rows } = await query(
    `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo, justificacion) VALUES ($1, $2, $3, $4) RETURNING *`,
    [turnoId, monto, tipo, justificacion]
  );
  return rows[0];
}

test.before(async () => {
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja Test 52', 'ACTIVA')`, [CAJA]);
});

test.after(async () => {
  await limpiar();
});

test("TDSI-52: arma el sobre sistema_origen/referencia_externa/tipo_operacion/fecha_documento/datos", async () => {
  const turno = await turnoCerrado();
  const dif = await diferencia({ turnoId: turno.id, tipo: "FALTANTE", monto: 15.5, justificacion: "Error al dar vuelto" });

  const msg = armarMensajeDiferencia({ diferencia: dif, turno });

  assert.deepEqual(msg, {
    sistema_origen: "GESTION_CAJA",
    referencia_externa: `DIF-${dif.id}`,
    tipo_operacion: "diferencia_caja",
    fecha_documento: DIA,
    datos: {
      caja: CAJA,
      cajero: "Ana Quispe",
      fecha_turno: DIA,
      tipo: "FALTANTE",
      monto: 15.5,
      justificacion: "Error al dar vuelto",
    },
  });
});

test("TDSI-52: la referencia DIF-<id> nunca choca con el formato de facturas (F-NNNNNN / ANU-F-NNNNNN)", async () => {
  const turno = await turnoCerrado();
  const dif = await diferencia({ turnoId: turno.id });
  const msg = armarMensajeDiferencia({ diferencia: dif, turno });
  assert.match(msg.referencia_externa, /^DIF-\d+$/);
  assert.doesNotMatch(msg.referencia_externa, /^(ANU-)?F-\d+$/);
});

test("TDSI-52: el monto sale como numero (la columna numeric de Postgres lo devuelve como string)", async () => {
  const turno = await turnoCerrado();
  const dif = await diferencia({ turnoId: turno.id, tipo: "SOBRANTE", monto: 12.3 });
  assert.equal(typeof dif.monto, "string", "pg devuelve numeric como string -- por eso hace falta aMonto/aCentavos");
  const msg = armarMensajeDiferencia({ diferencia: dif, turno });
  assert.equal(msg.datos.monto, 12.3);
  assert.equal(typeof msg.datos.monto, "number");
  assert.equal(msg.datos.tipo, "SOBRANTE");
});

test("TDSI-52: si falta justificacion, no arma el mensaje", async () => {
  const turno = await turnoCerrado();
  const dif = await diferencia({ turnoId: turno.id, justificacion: "   " });
  assert.throws(() => armarMensajeDiferencia({ diferencia: dif, turno }), (e) => e.status === 400 && /justificaci/i.test(e.message));
});

test("TDSI-52: si el tipo no es FALTANTE/SOBRANTE, no arma el mensaje", async () => {
  const turno = await turnoCerrado();
  assert.throws(
    () => armarMensajeDiferencia({ diferencia: { id: 1, tipo: "RARO", justificacion: "x" }, turno }),
    (e) => e.status === 400
  );
});

test("TDSI-52: usa cajero_id si no hay cajero_nombre", async () => {
  const turno = await turnoCerrado({ cajeroNombre: null });
  const dif = await diferencia({ turnoId: turno.id });
  const msg = armarMensajeDiferencia({ diferencia: dif, turno });
  assert.equal(msg.datos.cajero, "CAJ-52");
});
