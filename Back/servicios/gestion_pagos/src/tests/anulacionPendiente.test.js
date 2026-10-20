const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagoSimple } = require("../services/pagoSimpleService");
const {
  solicitarAnulacionPendiente,
  listarAnulacionesPendientes,
  autorizarAnulacionPendiente,
} = require("../services/ventasCajeroService");

// TDSI-542: semilla de ventas "en anulacion solicitada" para probar la bandeja
// del supervisor, sin depender de que exista ya una venta real en la base.

const CAJERO_TEST = "cajero.tdsi28.test";

async function crearVentaDePrueba(monto = 100) {
  const r = await registrarPagoSimple({ metodo: "Efectivo", monto, cajero: CAJERO_TEST });
  return r.pago.id_transaccion;
}

/** Simula la respuesta de facturacion a /api/supervisores/validar, sin llamarla de verdad. */
function mockValidacionSupervisor(ok, body) {
  const original = global.fetch;
  global.fetch = async () => ({
    ok,
    status: ok ? 200 : 401,
    json: async () => body,
  });
  return () => {
    global.fetch = original;
  };
}

test("TDSI-133: solicitar la anulacion deja la venta en espera", async () => {
  const idTransaccion = await crearVentaDePrueba();

  const r = await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Prueba TDSI-542",
  });

  assert.equal(r.estado, "Solicitada");
  assert.equal(r.id_transaccion, idTransaccion);
});

test("TDSI-133: no se puede solicitar sin motivo", async () => {
  const idTransaccion = await crearVentaDePrueba();
  await assert.rejects(
    () => solicitarAnulacionPendiente({ id_transaccion: idTransaccion, cajero: CAJERO_TEST, motivo: "" }),
    (e) => e.status === 400
  );
});

test("TDSI-539: la bandeja muestra numero, cliente, monto y motivo", async () => {
  const idTransaccion = await crearVentaDePrueba(250);
  await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Factura duplicada",
  });

  const pendientes = await listarAnulacionesPendientes();
  const solicitud = pendientes.find((s) => s.id_transaccion === idTransaccion);

  assert.ok(solicitud, "la solicitud debe aparecer en la bandeja");
  assert.equal(solicitud.monto, 250);
  assert.equal(solicitud.motivo, "Factura duplicada");
  assert.equal(solicitud.solicitado_por, CAJERO_TEST);
});

test("TDSI-540: PIN incorrecto no cambia el estado de la venta", async () => {
  const idTransaccion = await crearVentaDePrueba();
  const solicitud = await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Prueba PIN incorrecto",
  });

  const restaurarFetch = mockValidacionSupervisor(false, { mensaje: "Supervisor o PIN incorrecto" });
  await assert.rejects(
    () => autorizarAnulacionPendiente(solicitud.id, { supervisor_id: "SUP-TEST", pin: "0000", decision: "APROBAR" }),
    (e) => e.message.includes("PIN incorrecto")
  );
  restaurarFetch();

  const pendientes = await listarAnulacionesPendientes();
  assert.ok(
    pendientes.some((s) => s.id_transaccion === idTransaccion),
    "la solicitud debe seguir pendiente, sin resolverse"
  );
});

test("TDSI-541: PIN correcto aprueba y la venta queda Anulada", async () => {
  const idTransaccion = await crearVentaDePrueba();
  const solicitud = await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Prueba aprobar",
  });

  const restaurarFetch = mockValidacionSupervisor(true, {
    data: { supervisor_id: "SUP-TEST", nombre: "Supervisor Prueba" },
  });
  const r = await autorizarAnulacionPendiente(solicitud.id, {
    supervisor_id: "SUP-TEST",
    pin: "1234",
    decision: "APROBAR",
  });
  restaurarFetch();

  assert.equal(r.estado, "Autorizada");

  const pendientes = await listarAnulacionesPendientes();
  assert.ok(
    !pendientes.some((s) => s.id_transaccion === idTransaccion),
    "ya resuelta, no debe seguir en la bandeja"
  );
});

test("TDSI-541: rechazar devuelve la venta a Registrado (desbloqueada)", async () => {
  const idTransaccion = await crearVentaDePrueba();
  const solicitud = await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Prueba rechazar",
  });

  const restaurarFetch = mockValidacionSupervisor(true, {
    data: { supervisor_id: "SUP-TEST", nombre: "Supervisor Prueba" },
  });
  const r = await autorizarAnulacionPendiente(solicitud.id, {
    supervisor_id: "SUP-TEST",
    pin: "1234",
    decision: "RECHAZAR",
  });
  restaurarFetch();

  assert.equal(r.estado, "Rechazada");
});

test("TDSI-540/541: no se puede resolver dos veces la misma solicitud", async () => {
  const idTransaccion = await crearVentaDePrueba();
  const solicitud = await solicitarAnulacionPendiente({
    id_transaccion: idTransaccion,
    cajero: CAJERO_TEST,
    motivo: "Prueba doble resolucion",
  });

  const restaurarFetch = mockValidacionSupervisor(true, {
    data: { supervisor_id: "SUP-TEST", nombre: "Supervisor Prueba" },
  });
  await autorizarAnulacionPendiente(solicitud.id, { supervisor_id: "SUP-TEST", pin: "1234", decision: "APROBAR" });

  await assert.rejects(
    () => autorizarAnulacionPendiente(solicitud.id, { supervisor_id: "SUP-TEST", pin: "1234", decision: "APROBAR" }),
    (e) => e.status === 409
  );
  restaurarFetch();
});
