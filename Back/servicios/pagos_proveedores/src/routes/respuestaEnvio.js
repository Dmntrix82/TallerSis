// TDSI-122: respuesta HTTP comun para un intento de envio a Contabilidad.
//   ENVIADO   -> 200/201  Contabilidad recibio el reporte
//   PENDIENTE -> 202      Contabilidad no respondio; se reintenta solo (TDSI-422)
//   ERROR     -> 502      Contabilidad rechazo el reporte o se agotaron los intentos
function responderEnvio(res, envio, statusOk = 200) {
  if (envio.estado === "ENVIADO") {
    return res.status(statusOk).json({ ok: true, mensaje: "Reporte enviado a Contabilidad", data: envio });
  }
  if (envio.estado === "PENDIENTE") {
    return res.status(202).json({
      ok: true,
      mensaje: "Contabilidad no respondio. El envio se reintentara automaticamente",
      data: envio,
    });
  }
  return res.status(502).json({ ok: false, mensaje: "No se pudo enviar el reporte a Contabilidad", data: envio });
}

module.exports = { responderEnvio };