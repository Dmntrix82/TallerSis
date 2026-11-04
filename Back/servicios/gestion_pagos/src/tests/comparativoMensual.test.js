// TDSI-56/189/734/735: total vendido del mes, desglose por caja/metodo y variacion en
// % contra el mes anterior, sin contar anuladas. BD real; limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const { query, pool } = require("../config/db");
const {
  obtenerTotalDelMes, obtenerDesgloseMensual, rangoDelMes, mesAnteriorDe, calcularVariacion, validarMesAnio,
} = require("../services/comparativoMensualService");

const PREFIJO = `CMP-${Date.now()}`;
// Mes fijo (Bolivia, -04:00): el test no depende de en que mes se corra.
const ANIO = 2021;
const MES = 6; // junio 2021

async function transaccion(id, monto, fechaIso, estado = "Registrado", { metodo = "Efectivo", cajaId = null } = {}) {
  await query(
    `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, fecha, caja_id)
     VALUES ($1, $2, $3, 'Simple', $4, $5, $6)`,
    [id, metodo, monto, estado, fechaIso, cajaId]
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

test("TDSI-734: mesAnteriorDe cambia de año en enero", () => {
  assert.deepEqual(mesAnteriorDe(1, 2021), { mes: 12, anio: 2020 });
  assert.deepEqual(mesAnteriorDe(6, 2021), { mes: 5, anio: 2021 });
});

test("TDSI-734/735: desglose por caja y por metodo del mes elegido y del mes anterior, con variacion en %", async () => {
  const CAJA_A = `${PREFIJO}-CAJA-A`;
  const CAJA_B = `${PREFIJO}-CAJA-B`;

  // Marzo 2020 (mes elegido)
  await transaccion(`${PREFIJO}-m1`, 100, "2020-03-05T10:00:00-04:00", "Registrado", { metodo: "Efectivo", cajaId: CAJA_A });
  await transaccion(`${PREFIJO}-m2`, 50, "2020-03-06T10:00:00-04:00", "Registrado", { metodo: "Tarjeta", cajaId: CAJA_B });
  await transaccion(`${PREFIJO}-m3`, 30, "2020-03-07T10:00:00-04:00", "Registrado", { metodo: "QR", cajaId: CAJA_A });
  await transaccion(`${PREFIJO}-m4`, 999, "2020-03-08T10:00:00-04:00", "Anulado", { metodo: "Efectivo", cajaId: CAJA_A });
  await ventaOnline(`${PREFIJO}-m1`, 70, "2020-03-10T10:00:00-04:00", "Pagado");

  // Febrero 2020 (mes anterior) -- CAJA_B no vendio nada ese mes (ni aparece)
  await transaccion(`${PREFIJO}-a1`, 40, "2020-02-05T10:00:00-04:00", "Registrado", { metodo: "Efectivo", cajaId: CAJA_A });
  await ventaOnline(`${PREFIJO}-a1`, 10, "2020-02-10T10:00:00-04:00", "Pagado");

  const r = await obtenerDesgloseMensual(3, 2020);

  assert.equal(r.mes, 3);
  assert.equal(r.anio, 2020);
  assert.equal(r.mesAnterior, 2);
  assert.equal(r.anioAnterior, 2020);
  // (250-50)/50 * 100 = 400%
  assert.deepEqual(r.total, { actual: 250, anterior: 50, variacion: 400 });

  assert.deepEqual(r.porMetodo, [
    { metodo: "Efectivo", actual: 100, anterior: 40, variacion: 150 }, // (100-40)/40*100
    { metodo: "Tarjeta", actual: 50, anterior: 0, variacion: null }, // mes anterior en 0, hubo venta: no se puede expresar en %
    { metodo: "QR", actual: 30, anterior: 0, variacion: null },
    { metodo: "Online", actual: 70, anterior: 10, variacion: 600 }, // (70-10)/10*100
  ]);

  const porCaja = r.porCaja.filter((c) => [CAJA_A, CAJA_B].includes(c.caja_id));
  assert.deepEqual(porCaja, [
    { caja_id: CAJA_A, actual: 130, anterior: 40, variacion: 225 }, // (130-40)/40*100
    { caja_id: CAJA_B, actual: 50, anterior: 0, variacion: null }, // CAJA_B no existia el mes anterior
  ]);
});

test("TDSI-735: calcularVariacion maneja el mes anterior en cero", () => {
  assert.equal(calcularVariacion(0, 0), 0, "0 contra 0 no es una variacion, es 'sigue en cero'");
  assert.equal(calcularVariacion(150, 0), null, "no se puede expresar en % cuando no habia nada el mes anterior");
  assert.equal(calcularVariacion(150, 100), 50);
  assert.equal(calcularVariacion(50, 100), -50);
});
