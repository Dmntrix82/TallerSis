const repo = require("../data/confirmacionesRepo");
const compras = require("../clients/comprasClient");
const cfg = require("../config/compras");
const { AppError } = require("../utils/AppError");

function validarId(id) {
  const limpio = String(id ?? "").trim();
  if (!/^\d{1,18}$/.test(limpio) || Number(limpio) === 0)
    throw new AppError("El id de la orden de pago debe ser un número entero positivo", 400);
  return limpio;
}

function construirPayload(orden) {
  return {
    evento: "PAGO_REALIZADO",
    orden_pago_id: Number(orden.id),
    codigo: orden.numero ?? null,
    proveedor_id: null,
    monto: null,
    fecha_confirmacion: new Date().toISOString(),
  };
}

async function intentarEnvio(conf) {
  const r = await compras.enviarConfirmacion(conf.payload, `confirmacion-${conf.id}`);
  if (r.ok) return { enviada: true, orden: await repo.marcarEnviada(conf, r.status) };

  const f = await repo.registrarFallo(conf, r, cfg.MAX_INTENTOS, cfg.BACKOFF_BASE_SEG);
  return {
    enviada: false,
    estado: f.estado,
    intentos: f.intentos,
    proximo_intento_en: f.estado === "PENDIENTE" ? f.proximo_intento_en : null,
    error: f.ultimo_error,
  };
}

async function confirmarPago(id, { usuario_id } = {}) {
  const ordenId = validarId(id);
  if (typeof usuario_id !== "string" || !usuario_id.trim())
    throw new AppError("El campo 'usuario_id' es obligatorio", 400);
  if (usuario_id.trim().length > 60)
    throw new AppError("El 'usuario_id' no puede superar 60 caracteres", 400);

  const r = await repo.crearConfirmacion(
    ordenId,
    usuario_id.trim(),
    (orden) => {
      if (!orden) throw new AppError("Orden de pago no encontrada", 404);
      if (orden.estado !== "LIQUIDADA")
        throw new AppError(
          `La orden debe estar LIQUIDADA (egreso registrado) para confirmar. Estado actual: ${orden.estado}`,
          409
        );
      if (orden.confirmado_en)
        throw new AppError("El pago de esta orden ya fue confirmado a Compras", 409, {
          confirmado_por: orden.confirmado_por,
          confirmado_en: orden.confirmado_en,
        });
    },
    construirPayload
  );

  if (r.yaExiste)
    throw new AppError("Ya hay una confirmación en curso para esta orden", 409, {
      confirmacion_id: Number(r.yaExiste.id),
      estado: r.yaExiste.estado,
    });

  return intentarEnvio(r.confirmacion);
}

async function consultarConfirmacion(id) {
  const ordenId = validarId(id);
  const c = await repo.ultimaConfirmacion(ordenId);
  if (!c) throw new AppError("Esta orden no tiene confirmaciones", 404);
  return { ...c, id: Number(c.id) };
}

module.exports = { confirmarPago, consultarConfirmacion, intentarEnvio };