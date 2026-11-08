const { AppError } = require("../utils/AppError");
const repo = require("../data/productosVendidosRepo");
const enviosRepo = require("../data/enviosComprasRepo");
const { publicar } = require("../clients/pubsubPublisher");
const cfg = require("../config/compras");

/**
 * TDSI-54/185: productos vendidos de un dia (fecha "YYYY-MM-DD"), agrupados por
 * producto, ordenados de mas a menos vendido, sin contar facturas anuladas.
 */
async function obtenerProductosVendidos(fecha) {
  if (!fecha) {
    throw new AppError("Falta la fecha para agrupar los productos vendidos.", 400);
  }
  const desde = new Date(`${fecha}T00:00:00`);
  const hasta = new Date(`${fecha}T23:59:59.999`);
  if (Number.isNaN(desde.getTime())) {
    throw new AppError("La fecha no es válida.", 400, { fecha });
  }

  const productos = await repo.agruparPorProducto(desde, hasta);
  return { fecha, productos };
}

/**
 * TDSI-54/682/697: arma y publica el reporte del dia en "pagos-productos-vendidos", con
 * un identificador unico por fecha ("PV-<fecha>") para que Compras lo pueda tratar como
 * idempotente, y deja el intento registrado en pagos.envios_compras (TDSI-687) --
 * Enviado o Error -- para que la lectura del acuse (TDSI-697) sepa que marcar como
 * Recibido. "Si no hubo ventas ese dia, no se puede enviar" (regla del ticket). La
 * regla de "una vez por dia salvo Error" la aplica enviarACompras (TDSI-702), no esta
 * funcion -- publicarProductosVendidos se puede llamar mas de una vez (p.ej. un reenvio).
 */
async function publicarProductosVendidos(fecha) {
  const { productos } = await obtenerProductosVendidos(fecha);
  if (productos.length === 0) {
    throw new AppError("No hubo ventas ese día; no se puede enviar a Compras.", 409, { fecha });
  }

  const reporteId = `PV-${fecha}`;
  const mensaje = {
    reporte_id: reporteId,
    origen: "gestion_pagos",
    fecha,
    productos,
    generado_en: new Date().toISOString(),
  };

  const resultado = await publicar(cfg.PUBSUB_TOPIC, mensaje, {
    tipo: "PRODUCTOS_VENDIDOS",
    fecha,
    reporte_id: reporteId,
    idempotency_key: reporteId,
    origen: "gestion_pagos",
  });

  const envio = resultado.ok
    ? await enviosRepo.registrarEnviado(fecha, { reporteId, payload: mensaje, messageId: resultado.messageId })
    : await enviosRepo.registrarError(fecha, { reporteId, payload: mensaje, error: resultado.error });

  return { mensaje, resultado, envio };
}

/**
 * TDSI-54/702: lo que pide "Productos Vendidos" del Administrador -- la lista del dia
 * mas el estado del envio a Compras, si ya se intento alguno.
 */
async function obtenerConEstadoEnvio(fecha) {
  const resultado = await obtenerProductosVendidos(fecha);
  const envio = await enviosRepo.obtenerPorFecha(fecha);
  return {
    ...resultado,
    envio: envio
      ? { estado: envio.estado, intentos: envio.intentos, ultimoError: envio.ultimo_error, enviadoEn: envio.enviado_en, recibidoEn: envio.recibido_en }
      : null,
  };
}

/**
 * TDSI-54/702: boton "Enviar a Compras". "Cada dia se envia una sola vez, salvo que el
 * envio haya quedado en Error" (regla del ticket) -- si ya hay un envio Enviado o
 * Recibido para esa fecha, no se vuelve a publicar.
 */
async function enviarACompras(fecha) {
  if (!fecha) {
    throw new AppError("Falta la fecha para enviar el reporte a Compras.", 400);
  }
  const envioExistente = await enviosRepo.obtenerPorFecha(fecha);
  if (envioExistente && envioExistente.estado !== "Error") {
    throw new AppError(
      `El reporte de ese día ya se envió (estado: ${envioExistente.estado}). Solo se puede reenviar si quedó en Error.`,
      409,
      { fecha, estado: envioExistente.estado }
    );
  }
  return publicarProductosVendidos(fecha);
}

module.exports = { obtenerProductosVendidos, publicarProductosVendidos, obtenerConEstadoEnvio, enviarACompras };
