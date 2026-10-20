// TDSI-22: envio de facturas a Contabilidad (Grupo D) con un Pub/Sub simulado (no publica en Google).
// Usa la base real; las facturas de prueba se borran al final (sus envios caen por ON DELETE CASCADE).
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const facturasService = require("../services/facturasService");
const contabilidad = require("../services/contabilidadService");
const { procesarPendientes } = require("../jobs/reintentoEnviosContabilidad");
const { usarClienteDePrueba } = require("../clients/pubsubPublisher");
const cfg = require("../config/contabilidad");
const { pool } = require("../config/db");

const NIT = "7700112233";
const creadas = [];

function clienteFalso() {
  const falso = { publicados: [], fallas: [] };
  falso.topic = () => ({
    publishMessage: async (msg) => {
      const falla = falso.fallas.shift();
      if (falla) throw falla;
      falso.publicados.push(msg);
      return `msg-${falso.publicados.length}`;
    },
  });
  return falso;
}
const errorGrpc = (code, message) => Object.assign(new Error(message), { code });

async function nuevaFactura() {
  const f = await facturasService.crearFactura({
    nit: NIT,
    razon_social: "Ferreteria Prueba S.R.L.",
    items: [
      { descripcion: "Martillo", cantidad: 2, precio_unitario: 45.5 },
      { descripcion: "Clavos 1kg", cantidad: 1, precio_unitario: 19 },
    ],
  });
  creadas.push(f.id);
  await pool.query(
    `INSERT INTO facturacion.factura_metodos_pago (factura_id, metodo, monto) VALUES ($1,'Efectivo',60),($1,'QR',50)`,
    [f.id]
  );
  return f;
}

async function anularAutorizada(facturaId) {
  await pool.query(`UPDATE facturacion.facturas SET estado = 'Anulada' WHERE id = $1`, [facturaId]);
  await pool.query(
    `INSERT INTO facturacion.factura_anulaciones
       (factura_id, motivo, solicitado_por, estado, autorizado_por, autorizado_nombre, autorizado_en)
     VALUES ($1, 'Error en el monto', 'cajero1', 'Autorizada', 'SUP-1', 'Supervisor Uno', now())`,
    [facturaId]
  );
}

const vencer = (id) =>
  pool.query(`UPDATE facturacion.factura_envios_contabilidad SET proximo_intento_en = now() - interval '1 second' WHERE id = $1`, [id]);

let falso;
test.beforeEach(() => {
  cfg.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
  falso = clienteFalso();
  usarClienteDePrueba(falso);
});
test.after(async () => {
  usarClienteDePrueba(null);
  if (creadas.length) await pool.query(`DELETE FROM facturacion.facturas WHERE id = ANY($1::bigint[])`, [creadas]);
  await pool.end();
});

test("TDSI-22: al emitir se publica el mensaje 'venta' completo y el envio queda Enviado", async () => {
  const f = await nuevaFactura();
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "venta");
  assert.equal(envio.pubsub_message_id, "msg-1");
  assert.equal(envio.intentos, 1);

  const [{ json, attributes }] = falso.publicados;
  assert.equal(json.tipo, "FACTURA_VENTA");
  assert.equal(json.id_mensaje, `factura-${f.id}-venta`);
  assert.deepEqual(json.envio, { tipo: "venta" });
  assert.equal(json.factura.numero, f.numero);
  assert.deepEqual(json.cliente, { nit: NIT, razon_social: "Ferreteria Prueba S.R.L." });
  assert.deepEqual(json.items[0], { descripcion: "Martillo", cantidad: 2, precio_unitario: 45.5, subtotal: 91 });
  assert.deepEqual(json.metodos_pago, [{ metodo: "Efectivo", monto: 60 }, { metodo: "QR", monto: 50 }]);
  assert.deepEqual(json.totales, { subtotal: 110, descuento: 0, total: 110, base_imponible: 110, iva: { porcentaje: 13, monto: 14.3 } });
  assert.equal(json.anulacion, undefined);
  assert.deepEqual(attributes, {
    tipo: "FACTURA_VENTA", envio_tipo: "venta", factura_id: String(f.id), factura_numero: f.numero,
    idempotency_key: `factura-${f.id}-venta`, origen: "facturacion", grupo: "A",
  });
});

test("TDSI-22: una factura se envia una sola vez por tipo (uq_envio_factura_tipo)", async () => {
  const f = await nuevaFactura();
  const primero = await contabilidad.enviarFactura(f.id, "venta");
  const segundo = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(segundo.id, primero.id);
  assert.equal(falso.publicados.length, 1);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1`, [f.id]);
  assert.equal(rows[0].n, 1);
});

test("TDSI-22: la anulacion autorizada se publica como 'anulacion' con quien la pidio y autorizo", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  await assert.rejects(contabilidad.enviarFactura(f.id, "anulacion"), { status: 409 });

  await anularAutorizada(f.id);
  const envio = await contabilidad.enviarFactura(f.id, "anulacion");
  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "anulacion");

  const { json } = falso.publicados[1];
  assert.equal(json.tipo, "FACTURA_ANULACION");
  assert.equal(json.factura.estado, "Anulada");
  assert.equal(json.totales.total, 110);
  assert.equal(json.anulacion.motivo, "Error en el monto");
  assert.equal(json.anulacion.solicitado_por, "cajero1");
  assert.equal(json.anulacion.autorizado_nombre, "Supervisor Uno");
  const { rows } = await pool.query(
    `SELECT tipo FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1 ORDER BY tipo DESC`, [f.id]);
  assert.deepEqual(rows.map((r) => r.tipo), ["venta", "anulacion"]);
});

test("TDSI-22: si Pub/Sub no responde queda Pendiente y el worker lo publica despues", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Pendiente");
  assert.match(envio.ultimo_error, /UNAVAILABLE/);

  await vencer(envio.id);
  const [r] = await procesarPendientes({ facturaId: f.id });
  assert.equal(r.estado, "Enviado");
  assert.equal(r.intentos, 2);
  assert.equal(r.pubsub_message_id, "msg-1");
});

test("TDSI-22: sin permiso queda en Error; se lista y se puede reenviar", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(7, "7 PERMISSION_DENIED"));
  const envio = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(envio.estado, "Error");

  const { envios } = await contabilidad.listarEnvios({ estado: "error", tipo: "venta" });
  assert.ok(envios.some((e) => e.id === envio.id));
  await assert.rejects(contabilidad.listarEnvios({ estado: "OTRO" }), { status: 400 });

  const reenviado = await contabilidad.reenviarEnvio(envio.id);
  assert.equal(reenviado.estado, "Enviado");
  await assert.rejects(contabilidad.reenviarEnvio(envio.id), { status: 409 });
});

test("TDSI-22: sin topico configurado no registra ni publica nada", async () => {
  cfg.PUBSUB_TOPIC = null;
  const f = await nuevaFactura();
  const r = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(r.publicado, false);
  assert.equal(falso.publicados.length, 0);
});

test("TDSI-22: POST /api/facturas crea la factura y responde con el envio a Contabilidad", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/facturas", require("../routes/facturacionRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/api/facturas`;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit: NIT, razon_social: "Ferreteria Prueba S.R.L.", items: [{ descripcion: "Pala", cantidad: 1, precio_unitario: 80 }] }),
    });
    const cuerpo = await res.json();
    creadas.push(cuerpo.data.id);
    assert.equal(res.status, 201);
    assert.equal(cuerpo.contabilidad.estado, "Enviado");
    assert.equal(cuerpo.contabilidad.tipo, "venta");

    // Pub/Sub caido: la factura se crea igual (201) y el envio queda Pendiente
    falso.fallas.push(errorGrpc(14, "14 UNAVAILABLE"));
    const res2 = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit: NIT, razon_social: "Ferreteria Prueba S.R.L.", items: [{ descripcion: "Pico", cantidad: 1, precio_unitario: 70 }] }),
    });
    const cuerpo2 = await res2.json();
    creadas.push(cuerpo2.data.id);
    assert.equal(res2.status, 201);
    assert.equal(cuerpo2.contabilidad.estado, "Pendiente");

    const lista = await (await fetch(`${base}/envios-contabilidad?tipo=venta&limite=5`)).json();
    assert.ok(lista.data.envios.some((e) => e.factura_numero === cuerpo.data.numero));
  } finally {
    server.close();
  }
});
