// TDSI-51/685/686: POST /api/pagos/online exige el JWT del Sistema Cliente, y
// GET /api/pagos/online/ventas es el listado real para el Administrador.
// Usa la base real + facturacion (FACTURACION_URL), igual que marketplaceVentas.test.js.
process.env.MARKETPLACE_FACTURAS_TOPIC = "projects/proyecto-prueba/topics/pagos-facturas-emitidas";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { hashSecret } = require("../utils/secretHash");
const { generarToken } = require("../services/authService");
const publisher = require("../clients/pubsubPublisher");
const emailService = require("../services/emailService");

const PREFIJO = `RUTA-${Date.now()}`;
const NIT_PRUEBA = String(Date.now()).slice(-7);
const CLIENT_ID = `${PREFIJO}-cliente`;
const SECRET = "secreto-de-prueba-bien-largo-para-la-ruta-123456";

let servidor, base, token;

// Dia fijo para el listado (TDSI-686): el test no depende de en que fecha se corra.
const DIA = "2021-07-20";
const OTRO_DIA = "2021-07-21";

async function sembrarVentaDirecta({ ordenId, dia, estado = "Pagado", avisoEstado = null, numeroFactura = null, facturaEmailEstado = null }) {
  const { rows } = await query(
    `INSERT INTO pagos.ventas_online
       (orden_id, cliente_id, nit, tipo_documento, razon_social, total, metodo_pago, estado,
        codigo_confirmacion, numero_factura, aviso_marketplace_estado, recibida_en, email)
     VALUES ($1, 'Cliente Semilla', $2, 'CI', 'Cliente Semilla', 65, 'QR', $3, 'CNF-SEMILLA', $4, $5, ($6 || ' 10:00')::timestamp AT TIME ZONE 'America/La_Paz', 'cliente.semilla@correo-prueba.test')
     RETURNING id`,
    [ordenId, NIT_PRUEBA, estado, numeroFactura, avisoEstado, dia]
  );
  await query(
    `INSERT INTO pagos.venta_online_items (venta_id, sku, descripcion, cantidad, precio_unitario, subtotal)
     VALUES ($1, 'SKU-1', 'Producto semilla', 1, 65, 65)`,
    [rows[0].id]
  );
  if (facturaEmailEstado) {
    await query(
      `INSERT INTO pagos.facturas_enviadas (id_transaccion, email, estado, payload)
       VALUES ($1, 'cliente.semilla@correo-prueba.test', $2, '{}')`,
      [numeroFactura, facturaEmailEstado]
    );
  }
  return rows[0].id;
}

const ventaMsg = (ordenId, extra = {}) => ({
  ordenId,
  cliente: "Cliente Ruta",
  nit: NIT_PRUEBA,
  tipoDocumento: "CI",
  email: "cliente.ruta@correo-prueba.test",
  items: [{ sku: "ABC-1", descripcion: "Producto", cantidad: 1, precioUnitario: 40 }],
  total: 40,
  metodoPago: "Tarjeta",
  ...extra,
});

test.before(async () => {
  publisher.usarClienteDePrueba({ topic: () => ({ publishMessage: async () => "pub-1" }) });
  // El .env puede tener credenciales SMTP reales (produccion); en los tests se fuerza
  // "simulado" para no mandar correos de verdad.
  emailService.usarTransportadorDePrueba(null);

  await query(
    `INSERT INTO pagos.sistemas_cliente (client_id, nombre, secret_hash, activo)
     VALUES ($1, $2, $3, true)`,
    [CLIENT_ID, "Sistema de prueba de la ruta", hashSecret(SECRET)]
  );
  ({ access_token: token } = await generarToken({ client_id: CLIENT_ID, client_secret: SECRET }));

  const app = express();
  app.use(express.json());
  app.use("/api/pagos", require("../routes/ventaOnlineRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/pagos`;
});

test.after(async () => {
  servidor.close();
  publisher.usarClienteDePrueba(null);
  emailService.usarTransportadorDePrueba(undefined);
  await query(`DELETE FROM pagos.facturas_enviadas WHERE email IN ($1, 'cliente.semilla@correo-prueba.test')`, [ventaMsg("x").email]);
  await query(`DELETE FROM pagos.ventas_online WHERE orden_id LIKE $1`, [`${PREFIJO}%`]);
  await query(`DELETE FROM pagos.sistemas_cliente WHERE client_id = $1`, [CLIENT_ID]);
  await query(`DELETE FROM facturacion.facturas WHERE cliente_nit = $1`, [NIT_PRUEBA]);
  await query(`DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1`, [NIT_PRUEBA]);
  await pool.end();
});

test("TDSI-685: sin token responde 401 y no guarda nada", async () => {
  const r = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ventaMsg(`${PREFIJO}-1`)),
  });
  assert.equal(r.status, 401);
  const { rows } = await query(`SELECT 1 FROM pagos.ventas_online WHERE orden_id = $1`, [`${PREFIJO}-1`]);
  assert.equal(rows.length, 0);
});

test("TDSI-685: con un token invalido o de otro esquema responde 401", async () => {
  const r1 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer esto-no-es-un-jwt" },
    body: JSON.stringify(ventaMsg(`${PREFIJO}-2`)),
  });
  assert.equal(r1.status, 401);

  const r2 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${token}` },
    body: JSON.stringify(ventaMsg(`${PREFIJO}-2`)),
  });
  assert.equal(r2.status, 401);
});

test("TDSI-685: con un token valido, guarda la venta, emite la factura y se la manda al cliente por correo", async () => {
  const orden = `${PREFIJO}-3`;
  const r = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(ventaMsg(orden)),
  });
  assert.equal(r.status, 201);
  const cuerpo = await r.json();
  assert.equal(cuerpo.data.ordenId, orden);
  assert.equal(cuerpo.data.duplicada, false);

  // TDSI-51: el correo del cliente (no el Marketplace) recibe la factura digital
  // real; en el test, "simulada" porque usarTransportadorDePrueba(null) no manda nada de verdad.
  assert.match(cuerpo.data.numeroFactura, /^F-\d{6}$/);
  assert.equal(cuerpo.data.facturaEmail.envio.estado, "SIMULADO");
  assert.equal(cuerpo.data.facturaEmail.envio.email, ventaMsg("x").email);

  // un ordenId que ya no pasa la validacion del body (ej. items vacios) responde 400, no 500
  const rMala = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ordenId: `${PREFIJO}-mala`, nit: NIT_PRUEBA, tipoDocumento: "CI", email: "x@correo-prueba.test", items: [] }),
  });
  assert.equal(rMala.status, 400);
  assert.match((await rMala.json()).mensaje, /ítem/);
});

test("TDSI-51: sin correo (o con uno invalido) responde 400, no se guarda la venta", async () => {
  const sinCorreo = `${PREFIJO}-sin-correo`;
  const r1 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(ventaMsg(sinCorreo, { email: undefined })),
  });
  assert.equal(r1.status, 400);
  assert.match((await r1.json()).mensaje, /correo/i);

  const invalido = `${PREFIJO}-correo-invalido`;
  const r2 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(ventaMsg(invalido, { email: "esto-no-es-un-correo" })),
  });
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).mensaje, /correo/i);

  const { rows } = await query(`SELECT 1 FROM pagos.ventas_online WHERE orden_id IN ($1, $2)`, [sinCorreo, invalido]);
  assert.equal(rows.length, 0);
});

test("TDSI-685: la misma orden recibida dos veces por HTTP no se duplica (200, no 201)", async () => {
  const orden = `${PREFIJO}-4`;
  const r1 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(ventaMsg(orden)),
  });
  assert.equal(r1.status, 201);

  const r2 = await fetch(`${base}/online`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(ventaMsg(orden)),
  });
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).data.duplicada, true);

  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM pagos.ventas_online WHERE orden_id = $1`, [orden]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-686: GET /online/ventas trae las ventas reales con su detalle de items, correo y envio de factura", async () => {
  const pagada = `${PREFIJO}-pagada`;
  const anulada = `${PREFIJO}-anulada`;
  const otroDia = `${PREFIJO}-otrodia`;
  await sembrarVentaDirecta({ ordenId: pagada, dia: DIA, estado: "Pagado", numeroFactura: "F-000099", avisoEstado: "Enviado", facturaEmailEstado: "ENVIADO" });
  await sembrarVentaDirecta({ ordenId: anulada, dia: DIA, estado: "Anulado" });
  await sembrarVentaDirecta({ ordenId: otroDia, dia: OTRO_DIA, estado: "Pagado" });

  const r = await fetch(`${base}/online/ventas?desde=${DIA}&hasta=${DIA}`);
  assert.equal(r.status, 200);
  const { data } = await r.json();
  const ordenes = data.map((v) => v.orden_id);
  assert.ok(ordenes.includes(pagada) && ordenes.includes(anulada));
  assert.ok(!ordenes.includes(otroDia), "no debe traer ventas de otro dia");

  const fila = data.find((v) => v.orden_id === pagada);
  assert.equal(fila.total, 65);
  assert.equal(fila.metodo_pago, "QR");
  assert.equal(fila.numero_factura, "F-000099");
  assert.equal(fila.aviso_marketplace_estado, "Enviado");
  assert.equal(fila.email, "cliente.semilla@correo-prueba.test");
  assert.equal(fila.factura_email_estado, "ENVIADO");
  assert.deepEqual(fila.items, [{ sku: "SKU-1", descripcion: "Producto semilla", cantidad: 1, precio_unitario: 65, subtotal: 65 }]);

  // sin factura (estado Anulado, nunca se emitio) no hay nada que haya intentado mandarse.
  const filaAnulada = data.find((v) => v.orden_id === anulada);
  assert.equal(filaAnulada.factura_email_estado, null);
});

test("TDSI-686: filtra por estado", async () => {
  const r = await fetch(`${base}/online/ventas?desde=${DIA}&hasta=${DIA}&estado=Anulado`);
  const { data } = await r.json();
  const ordenes = data.map((v) => v.orden_id);
  assert.ok(ordenes.includes(`${PREFIJO}-anulada`));
  assert.ok(!ordenes.includes(`${PREFIJO}-pagada`));
});

test("TDSI-51: POST /online/:id/reenviar-marketplace reenvia el aviso Pub/Sub de una factura ya emitida", async () => {
  const orden = `${PREFIJO}-reenvio`;
  const idVenta = await sembrarVentaDirecta({ ordenId: orden, dia: DIA, estado: "Pagado", numeroFactura: "F-REENVIO" });

  const r = await fetch(`${base}/online/${idVenta}/reenviar-marketplace`, { method: "POST" });
  assert.equal(r.status, 200);
  const { data } = await r.json();
  assert.equal(data.publicado, true);
  assert.ok(data.messageId);

  const { rows } = await query(`SELECT aviso_marketplace_estado FROM pagos.ventas_online WHERE id = $1`, [idVenta]);
  assert.equal(rows[0].aviso_marketplace_estado, "Enviado");
});

test("TDSI-51: reenviar-marketplace responde 409 si la orden todavia no tiene factura, y 404 si no existe", async () => {
  const orden = `${PREFIJO}-sin-factura`;
  const idVenta = await sembrarVentaDirecta({ ordenId: orden, dia: DIA, estado: "Pagado" });

  const r1 = await fetch(`${base}/online/${idVenta}/reenviar-marketplace`, { method: "POST" });
  assert.equal(r1.status, 409);

  const r2 = await fetch(`${base}/online/999999999/reenviar-marketplace`, { method: "POST" });
  assert.equal(r2.status, 404);
});

test("TDSI-686: valida fecha y estado invalidos", async () => {
  const r1 = await fetch(`${base}/online/ventas?desde=no-es-fecha`);
  assert.equal(r1.status, 400);

  const r2 = await fetch(`${base}/online/ventas?estado=Pendiente`);
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).mensaje, /Pagado.*Anulado/);
});
