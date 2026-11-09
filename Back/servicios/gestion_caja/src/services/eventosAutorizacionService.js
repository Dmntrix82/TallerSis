const { AppError } = require("../utils/AppError");
const repo = require("../data/eventosAutorizacionRepo");
const { hoyLocal, validarDia, limitesDelRango } = require("../utils/fechas");

const RANGO_MAXIMO_DIAS = 92;

function validarSupervisorOpcional(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = String(valor).trim();
  if (!texto || texto.length > 60) {
    throw new AppError("El campo 'supervisor_id' debe tener entre 1 y 60 caracteres.", 400, { supervisor_id: valor });
  }
  return texto;
}

function validarRango({ desde, hasta } = {}) {
  const d = desde ? validarDia(desde, "desde") : hasta ? validarDia(hasta, "hasta") : hoyLocal();
  const h = hasta ? validarDia(hasta, "hasta") : d;
  if (d > h) throw new AppError("'desde' no puede ser mayor que 'hasta'", 400, { desde, hasta });
  const dias = (Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000 + 1;
  if (dias > RANGO_MAXIMO_DIAS) throw new AppError(`El rango no puede superar ${RANGO_MAXIMO_DIAS} dias`, 400, { desde: d, hasta: h });
  return { desde: d, hasta: h };
}

/**
 * TDSI-62/963/964/965: apertura, cierre y aprobacion de operaciones especiales de un
 * rango de dias (hora de Bolivia; por defecto los ultimos 7), con filtro opcional por
 * el supervisor que autorizo -- mismo criterio de rango y filtro que el historial de
 * ventas de gestion_pagos (TDSI-956/957), para que el Front pueda combinar ambos.
 */
async function listarEventos({ desde, hasta, supervisor_id } = {}) {
  const rango = validarRango({ desde, hasta });
  const supervisorId = validarSupervisorOpcional(supervisor_id);
  const { inicio, fin } = limitesDelRango(rango.desde, rango.hasta);

  const eventos = await repo.listar({ inicio, fin, supervisorId });

  return {
    filtros: { ...rango, supervisor_id: supervisorId },
    total: eventos.length,
    // El nombre del supervisor, no solo su codigo (igual que TDSI-956 en gestion_pagos).
    eventos: eventos.map((e) => ({
      tipo: e.tipo,
      fecha: e.fecha,
      caja_id: e.caja_id,
      pedido_por: e.pedido_por,
      autorizado_por: e.autorizado_por_nombre || e.autorizado_por || null,
      monto: e.monto,
      descripcion: e.descripcion,
    })),
  };
}

module.exports = { listarEventos };
