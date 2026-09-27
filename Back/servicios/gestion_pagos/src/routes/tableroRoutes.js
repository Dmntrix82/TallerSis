const { Router } = require("express");
const { obtenerIngresosDelDia } = require("../services/tableroService");
const { tableroEvents } = require("../utils/tableroEvents");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-381: ?fecha=YYYY-MM-DD filtra el tablero por un dia especifico; sin ella, es hoy.
router.get("/ingresos-dia", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerIngresosDelDia(req.query.fecha) });
}));

/** TDSI-378: empuja el tablero actualizado (Server-Sent Events) cada vez que entra una venta */
router.get("/ingresos-dia/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const enviar = async () => {
    const data = await obtenerIngresosDelDia();
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  await enviar();
  tableroEvents.on("actualizacion", enviar);

  req.on("close", () => {
    tableroEvents.off("actualizacion", enviar);
  });
});

module.exports = router;
