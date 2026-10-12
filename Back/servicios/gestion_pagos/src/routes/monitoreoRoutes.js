const { Router } = require("express");
const { obtenerMonitoreo } = require("../services/monitoreoService");
const { tableroEvents } = require("../utils/tableroEvents");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

const LATIDO_MS = 25000;

// TDSI-426/123: monitoreo de operaciones de cajeros (panel del Supervisor de Caja).
// GET /api/pagos/monitoreo?caja_id=CAJA-01&cajero_id=ana@x.bo&fecha=YYYY-MM-DD&limite=5
//   todos los filtros son opcionales; fecha por defecto = hoy (hora de Bolivia), limite 1..20 (5)
// 200 { fecha, filtros, actualizado_en, totales, cajeros: [{ resumen..., ultima_operacion, operaciones }] }
//     (cajeros: [] = "sin operaciones")
// 400 filtro invalido
router.get("/", wrap(async (req, res) => {
  const { caja_id, cajero_id, fecha, limite } = req.query;
  // El panel lo consulta cada pocos segundos: nunca debe responder algo guardado en cache.
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, data: await obtenerMonitoreo({ caja_id, cajero_id, fecha, limite }) });
}));

// TDSI-123: el mismo monitoreo EN TIEMPO REAL (Server-Sent Events), igual que el tablero (TDSI-378).
// GET /api/pagos/monitoreo/stream con los mismos filtros. Envia el monitoreo completo al conectarse
// y de nuevo cada vez que se registra, anula o cambia de estado una operacion, sin esperar al polling.
// En el front: new EventSource("http://localhost:4005/api/pagos/monitoreo/stream?caja_id=...")
//   evento "message" -> data = mismo objeto que GET /api/pagos/monitoreo
//   evento "error"   -> data = { mensaje } (la conexion sigue abierta y se reintenta en la proxima operacion)
// 400 (JSON, sin abrir el stream) si algun filtro es invalido.
router.get("/stream", wrap(async (req, res) => {
  const { caja_id, cajero_id, fecha, limite } = req.query;
  const filtros = { caja_id, cajero_id, fecha, limite };

  // Se valida y arma la primera respuesta ANTES de abrir el stream: un filtro malo responde 400 normal.
  const inicial = await obtenerMonitoreo(filtros);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-store",
    Connection: "keep-alive",
  });
  res.write("retry: 5000\n\n");
  res.write(`data: ${JSON.stringify(inicial)}\n\n`);

  // Si entran varias ventas seguidas, no se lanzan consultas en paralelo: se hace una mas al terminar.
  let enCurso = false;
  let pendiente = false;
  const enviar = async () => {
    if (enCurso) { pendiente = true; return; }
    enCurso = true;
    try {
      do {
        pendiente = false;
        const data = await obtenerMonitoreo(filtros);
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      } while (pendiente);
    } catch (e) {
      console.error("[monitoreo] Error enviando el monitoreo en vivo:", e.message);
      if (!res.writableEnded) res.write(`event: error\ndata: ${JSON.stringify({ mensaje: "No se pudo actualizar el monitoreo" })}\n\n`);
    } finally {
      enCurso = false;
    }
  };

  // Comentario SSE periodico para que proxies/navegador no cierren la conexion por inactividad.
  const latido = setInterval(() => res.write(": ping\n\n"), LATIDO_MS);
  tableroEvents.on("actualizacion", enviar);

  req.on("close", () => {
    clearInterval(latido);
    tableroEvents.off("actualizacion", enviar);
  });
}));

module.exports = router;