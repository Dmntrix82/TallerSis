// TDSI-56/189: total vendido (caja fisica + online) de un mes, sin contar anuladas.
// BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const { obtenerTotalDelMes, rangoDelMes, validarMesAnio } = require("../services/comparativoMensualService");

const PREFIJO = `CMP-${Date.now()}`;
// Mes fijo (Bolivia, -04:00): el test no depende de en que mes se corra.
const ANIO = 2021;
const MES = 6; // junio 2021

async function transaccion(id, monto, fechaIso, estado = "Registrado") {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha)
     VALUES ($1, 'Efectivo', $2, 'Simple', $3, $4)`,
    [id, monto, estado, fechaIso]
  );
}

async function ventaOnline(ordenId, total, fechaIso, estado = "Pagado") {
  await query(
    `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, estado, codigo_confirmacion, recibida_en)
     VALUES ($1, 'Cliente', $2, 'QR', $3, 'CNF-TEST', $4)`,
    [ordenId, total, estado, fechaIso]
  );
}

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id LIKE $1`, [`${PREFIJO}%`]);
  await pool.end();
});

test("TDSI-189: suma caja fisica + online del mes, sin contar anuladas, y respeta los limites del mes", async () => {
  // Dentro de junio: debe contar
  await transaccion(`${PREFIJO}-1`, 100, "2021-06-01T00:00:00-04:00", "Registrado");
  await ventaOnline(`${PREFIJO}-1`, 200, "2021-06-15T12:00:00-04:00", "Pagado");

  // Anuladas: NO deben contar aunque esten dentro de junio
  await transaccion(`${PREFIJO}-2`, 999, "2021-06-05T10:00:00-04:00", "Anulado");
  await ventaOnline(`${PREFIJO}-2`, 888, "2021-06-16T10:00:00-04:00", "Anulado");

  // Fuera del mes: el ultimo instante de mayo y el primer instante de julio (Bolivia) NO deben contar
  await transaccion(`${PREFIJO}-3`, 50, "2021-05-31T23:59:59-04:00", "Registrado");
  await ventaOnline(`${PREFIJO}-3`, 400, "2021-07-01T00:00:00-04:00", "Pagado");

  const r = await obtenerTotalDelMes(MES, ANIO);
  assert.deepEqual(r, { mes: MES, anio: ANIO, total: 300 });
});

test("TDSI-189: diciembre -> enero del año siguiente", () => {
  const { desde, hasta } = rangoDelMes(2021, 12);
  assert.equal(desde.toISOString(), "2021-12-01T04:00:00.000Z"); // 2021-12-01 00:00 -04:00
  assert.equal(hasta.toISOString(), "2022-01-01T04:00:00.000Z"); // 2022-01-01 00:00 -04:00
});

test("TDSI-189: valida mes (1-12) y año", () => {
  assert.throws(() => validarMesAnio(0, 2021), (e) => e.status === 400);
  assert.throws(() => validarMesAnio(13, 2021), (e) => e.status === 400);
  assert.throws(() => validarMesAnio(6, 1999), (e) => e.status === 400);
  assert.throws(() => validarMesAnio("abc", 2021), (e) => e.status === 400);
});

test("TDSI-189: un mes sin ventas da total 0", async () => {
  const r = await obtenerTotalDelMes(1, 2019);
  assert.deepEqual(r, { mes: 1, anio: 2019, total: 0 });
});
