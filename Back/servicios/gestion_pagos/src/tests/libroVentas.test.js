// TDSI-50/750: Libro de Ventas del mes (usa la BD real; limpia lo que crea).
// Las ventas se mueven a un mes fijo de 2021 para no depender de en que mes se corra el test.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pool, query } = require("../config/db");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const { registrarPagoMixto } = require("../services/pagoMixtoService");
const pagosRepo = require("../data/pagosRepo");
const { obtenerLibroVentas } = require("../services/libroVentasService");
const { generarLibroVentasExcel } = require("../services/libroVentasExcelService");
const ExcelJS = require("exceljs");

const SUFIJO = `test.libroventas.${Date.now()}`;
const MES = 6;
const ANIO = 2021;

const moverA = (idTransaccion, dia) =>
  pool.query(
    `UPDATE pagos.transacciones SET fecha = ($2::date + time '10:00')::timestamp AT TIME ZONE 'America/La_Paz' WHERE id_transaccion = $1`,
    [idTransaccion, dia]
  );

const ventas = {};

test.before(async () => {
  // Venta 1: simple, valida, 113 Bs (base 100 + debito 13 exactos)
  ventas.v1 = await registrarPagoSimple({
    metodo: "Efectivo", monto: 113, tipo_documento: "NIT",
    nit: "1234567011", razon_social: `Cliente Uno ${SUFIJO}`, cajero: SUFIJO,
  });
  await moverA(ventas.v1.pago.id_transaccion, "2021-06-05");

  // Venta 2: mixta (2 filas en pagos.transacciones, mismo id_transaccion), valida, total 200
  ventas.v2 = await registrarPagoMixto({
    total: 200, metodos: [{ metodo: "Efectivo", monto: 80 }, { metodo: "Tarjeta", monto: 120 }],
    tipo_documento: "NIT", nit: "7654321022", razon_social: `Cliente Dos ${SUFIJO}`, cajero: SUFIJO,
  });
  await moverA(ventas.v2.pago.id_transaccion, "2021-06-10");

  // Venta 3: simple, se anula, 50 Bs
  ventas.v3 = await registrarPagoSimple({
    metodo: "QR", monto: 50, tipo_documento: "NIT",
    nit: "1112223033", razon_social: `Cliente Tres ${SUFIJO}`, cajero: SUFIJO,
  });
  await moverA(ventas.v3.pago.id_transaccion, "2021-06-15");
  await pagosRepo.anularTransaccion(ventas.v3.pago.id_transaccion, { anulado_por: SUFIJO });
});

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE cajero = $1`, [SUFIJO]);
});

test("TDSI-177/747: agrupa por factura, calcula base+debito del 13% y deja las anuladas en cero", async () => {
  const libro = await obtenerLibroVentas(MES, ANIO);
  const filas = libro.filas.filter((f) => f.razon_social.includes(SUFIJO));
  assert.equal(filas.length, 3);

  const f1 = filas.find((f) => f.numero_factura === ventas.v1.pago.id_transaccion);
  assert.equal(f1.total, 113);
  assert.equal(f1.importe_base, 100);
  assert.equal(f1.debito_fiscal, 13);
  assert.equal(f1.estado, "V");

  const f2 = filas.find((f) => f.numero_factura === ventas.v2.pago.id_transaccion);
  assert.equal(f2.total, 200);
  assert.equal(f2.estado, "V");
  assert.ok(Math.abs(f2.importe_base + f2.debito_fiscal - f2.total) < 0.01, "base + debito debe dar el total");

  const f3 = filas.find((f) => f.numero_factura === ventas.v3.pago.id_transaccion);
  assert.equal(f3.total, 0);
  assert.equal(f3.importe_base, 0);
  assert.equal(f3.debito_fiscal, 0);
  assert.equal(f3.estado, "A");

  assert.ok(f1.numero < f2.numero && f2.numero < f3.numero, "el orden debe ser por fecha");
});

test("TDSI-748: rechaza mes/anio invalidos", async () => {
  await assert.rejects(() => obtenerLibroVentas(13, ANIO), /mes.*entre 1 y 12/i);
  await assert.rejects(() => obtenerLibroVentas(MES, 1800), /año/i);
});

test("TDSI-749: el Excel tiene las columnas del formato de Impuestos y una fila de totales", async () => {
  const libro = await obtenerLibroVentas(MES, ANIO);
  const buffer = await generarLibroVentasExcel(libro);
  assert.ok(buffer.length > 0);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const hoja = workbook.worksheets[0];
  const encabezados = hoja.getRow(1).values.filter(Boolean);
  assert.deepEqual(encabezados, [
    "N°", "Fecha", "N° Factura", "NIT/CI", "Nombre o Razón Social",
    "Importe Total", "Descuento", "Importe Base para el IVA", "Débito Fiscal (13%)", "Estado",
  ]);
  // encabezado + al menos las filas del mes + fila de totales
  assert.ok(hoja.rowCount >= libro.filas.length + 2);
});
