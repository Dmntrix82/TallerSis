const { Router } = require("express");
const { obtenerIngresosDelDia, obtenerRankings, obtenerSerieDiaria } = require("../services/tableroService");
const { obtenerDesgloseMensual } = require("../services/comparativoMensualService");
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

// TDSI-330: rankings (que caja/cajero/cliente generan mas), historico completo.
router.get("/rankings", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerRankings() });
}));

// TDSI-331: serie de los ultimos N dias (?dias=14), para el grafico de montanas.
router.get("/serie-diaria", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerSerieDiaria(req.query.dias) });
}));

// TDSI-56/737: "Comparativo mensual" -- total, por caja y por metodo del mes elegido
// contra el mes anterior (o los mismos dias, si el mes elegido es el actual).
// Sin ?mes=&anio=, usa el mes y año de hoy (en hora de Bolivia).
router.get("/comparativo-mensual", wrap(async (req, res) => {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  const [anioHoy, mesHoy] = hoy.split("-");
  const mes = req.query.mes ?? mesHoy;
  const anio = req.query.anio ?? anioHoy;
  res.json({ ok: true, data: await obtenerDesgloseMensual(mes, anio) });
}));

module.exports = router;
