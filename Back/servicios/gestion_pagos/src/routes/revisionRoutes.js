const { Router } = require("express");
const {
  listarCajerosParaRevision,
  listarTransaccionesPorCajero,
  obtenerResumenCajero,
  marcarRevision,
} = require("../services/revisionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-27/131: API de revision de transacciones por cajero (Supervisor de Caja).
// Rango de fechas en todos los GET: ?fecha=YYYY-MM-DD  o  ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// (sin fecha = hoy, hora de Bolivia; rango maximo 92 dias). 400 si algun filtro es invalido.

// Cajeros con ventas en el rango (para elegir a quien revisar).
// 200 { filtros, total, cajeros: [{ cajero_id, cajero, cantidad_transacciones, total, sin_revisar, observadas }] }
router.get("/cajeros", wrap(async (req, res) => {
  const { fecha, desde, hasta } = req.query;
  res.json({ ok: true, data: await listarCajerosParaRevision({ fecha, desde, hasta }) });
}));

// TDSI-427/429: transacciones del cajero, paginadas, con su revision.
// ?cajero_id=... (obligatorio) &metodo=Efectivo|Tarjeta|QR &estado_revision=PENDIENTE|REVISADA|OBSERVADA
// &pagina=1 &por_pagina=20 (max 100)
// 200 { cajero_id, filtros, paginacion: { pagina, por_pagina, total_registros, total_paginas }, transacciones: [...] }
router.get("/transacciones", wrap(async (req, res) => {
  const { cajero_id, fecha, desde, hasta, metodo, estado_revision, pagina, por_pagina } = req.query;
  res.json({
    ok: true,
    data: await listarTransaccionesPorCajero({ cajero_id, fecha, desde, hasta, metodo, estado_revision, pagina, por_pagina }),
  });
}));

// TDSI-428: resumen del cajero (cantidad y total por metodo, por estado y por revision).
// ?cajero_id=... (obligatorio)
router.get("/resumen", wrap(async (req, res) => {
  const { cajero_id, fecha, desde, hasta } = req.query;
  res.json({ ok: true, data: await obtenerResumenCajero({ cajero_id, fecha, desde, hasta }) });
}));

// TDSI-429: marcar una transaccion como REVISADA u OBSERVADA.
// Body: { "estado": "REVISADA" | "OBSERVADA", "nota": "...", "revisado_por": "usuario del supervisor" }
// (la nota es obligatoria si es OBSERVADA). Volver a marcar reemplaza la revision anterior.
// 200 revision guardada | 400 datos invalidos | 404 la transaccion no existe
router.put("/transacciones/:id_transaccion", wrap(async (req, res) => {
  const { estado, nota, revisado_por } = req.body || {};
  const revision = await marcarRevision({ id_transaccion: req.params.id_transaccion, estado, nota, revisado_por });
  res.json({ ok: true, mensaje: `Transaccion ${revision.id_transaccion} marcada como ${revision.estado}`, data: revision });
}));

module.exports = router;