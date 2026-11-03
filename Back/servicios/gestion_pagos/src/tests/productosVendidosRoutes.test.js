// TDSI-54/702: GET /api/productos-vendidos?fecha= y POST /api/productos-vendidos/:fecha/enviar-compras.
// Pub/Sub simulado; BD real.
process.env.COMPRAS_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/pagos-productos-vendidos";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { obtenerConEstadoEnvio, enviarACompras } = require("../services/productosVendidosService");
const publisher = require("../clients/pubsubPublisher");

const PREFIJO = `PVR-${Date.now()}`;
const FECHA_CON_VENTAS = "2021-11-05";
const FECHA_SIN_VENTAS = "2021-11-06";
let servidor, base;

const topicoQuePublicaBien = () => ({ topic: () => ({ publishMessage: async () => "pub-ok" }) });
const topicoQueFalla = (motivo) => ({ topic: () => ({ publishMessage: async () => { throw new Error(motivo); } }) });

async function sembrarVenta() {
  const { rows } = await query(
    `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, estado, codigo_confirmacion, recibida_en)
     VALUES ($1, 'Cliente', 50, 'QR', 'Pagado', 'CNF-TEST', ($2 || ' 10:00')::timestamp AT TIME ZONE 'America/La_Paz')
     RETURNING id`,
    [`${PREFIJO}-1`, FECHA_CON_VENTAS]
  );
  await query(
    `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
     VALUES ($1, 'YOG-01', 'Yogurt 1L', 5, 10, 50)`,
    [rows[0].id]
  );
}

test.before(async () => {
  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  await sembrarVenta();

  const app = express();
  app.use(express.json());
  app.use("/api", require("../routes/productosVendidosRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api`;
});

test.after(async () => {
  servidor.close();
  publisher.usarClienteDePrueba(null);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.envios_compras WHERE fecha = ANY($1::date[])`, [[FECHA_CON_VENTAS, FECHA_SIN_VENTAS]]);
  await pool.end();
});

test("TDSI-702: sin envio todavia, envio sale null", async () => {
  const r = await obtenerConEstadoEnvio(FECHA_CON_VENTAS);
  assert.ok(r.productos.some((p) => p.sku === "YOG-01"));
  assert.equal(r.envio, null);
});

test("TDSI-702: enviarACompras publica, y no deja reenviar el mismo dia salvo que haya quedado en Error", async () => {
  const r1 = await enviarACompras(FECHA_CON_VENTAS);
  assert.equal(r1.resultado.ok, true);
  assert.equal(r1.envio.estado, "Enviado");

  const conEnvio = await obtenerConEstadoEnvio(FECHA_CON_VENTAS);
  assert.equal(conEnvio.envio.estado, "Enviado");

  await assert.rejects(() => enviarACompras(FECHA_CON_VENTAS), (e) => e.status === 409 && /ya se envió/i.test(e.message));
});

test("TDSI-702: si el envio anterior quedo en Error, si se puede reenviar", async () => {
  const fecha = "2021-11-07";
  const { rows } = await query(
    `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, estado, codigo_confirmacion, recibida_en)
     VALUES ($1, 'Cliente', 30, 'QR', 'Pagado', 'CNF-TEST', ($2 || ' 10:00')::timestamp AT TIME ZONE 'America/La_Paz')
     RETURNING id`,
    [`${PREFIJO}-2`, fecha]
  );
  await query(
    `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
     VALUES ($1, 'PAN-02', 'Pan', 3, 10, 30)`,
    [rows[0].id]
  );

  publisher.usarClienteDePrueba(topicoQueFalla("sin conexion"));
  const r1 = await enviarACompras(fecha);
  assert.equal(r1.envio.estado, "Error");

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const r2 = await enviarACompras(fecha);
  assert.equal(r2.envio.estado, "Enviado");

  await query(`DELETE FROM pagos.envios_compras WHERE fecha = $1`, [fecha]);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id = $1`, [`${PREFIJO}-2`]);
});

test("TDSI-702: no se puede enviar un dia sin ventas", async () => {
  await assert.rejects(() => enviarACompras(FECHA_SIN_VENTAS), (e) => e.status === 409 && /no hubo ventas/i.test(e.message));
});

test("TDSI-702: GET /api/productos-vendidos y POST .../enviar-compras", async () => {
  const fecha = "2021-11-08";
  const { rows } = await query(
    `INSERT INTO pagos.ventas_online (orden_id, cliente_id, total, metodo_pago, estado, codigo_confirmacion, recibida_en)
     VALUES ($1, 'Cliente', 20, 'QR', 'Pagado', 'CNF-TEST', ($2 || ' 10:00')::timestamp AT TIME ZONE 'America/La_Paz')
     RETURNING id`,
    [`${PREFIJO}-3`, fecha]
  );
  await query(
    `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
     VALUES ($1, 'HUE-03', 'Huevos', 2, 10, 20)`,
    [rows[0].id]
  );

  const lista = await fetch(`${base}/productos-vendidos?fecha=${fecha}`);
  assert.equal(lista.status, 200);
  const cuerpoLista = await lista.json();
  assert.ok(cuerpoLista.data.productos.some((p) => p.sku === "HUE-03"));
  assert.equal(cuerpoLista.data.envio, null);

  publisher.usarClienteDePrueba(topicoQuePublicaBien());
  const envio = await fetch(`${base}/productos-vendidos/${fecha}/enviar-compras`, { method: "POST" });
  assert.equal(envio.status, 200);
  const cuerpoEnvio = await envio.json();
  assert.equal(cuerpoEnvio.data.envio.estado, "Enviado");

  const otraVez = await fetch(`${base}/productos-vendidos/${fecha}/enviar-compras`, { method: "POST" });
  assert.equal(otraVez.status, 409);

  await query(`DELETE FROM pagos.envios_compras WHERE fecha = $1`, [fecha]);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id = $1`, [`${PREFIJO}-3`]);
});
