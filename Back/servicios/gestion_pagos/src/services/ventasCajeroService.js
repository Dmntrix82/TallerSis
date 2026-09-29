const { AppError } = require("../utils/AppError");
const repo = require("../data/pagosRepo");
const { validarSupervisor } = require("./supervisorProxy");
const { emitirActualizacion } = require("../utils/tableroEvents");
const { validarFormatoDocumento } = require("../utils/documento");

// TDSI-306: mismo plazo de 2 horas que la anulacion de facturas en facturacion.
const PLAZO_ANULACION_MS = 2 * 60 * 60 * 1000;

function dentroDelPlazo(fecha) {
  return Date.now() - new Date(fecha).getTime() <= PLAZO_ANULACION_MS;
}

/**
 * El cajero ve unicamente sus propias ventas en la pantalla de Facturas.
 * TDSI-307: desde/hasta (strings "YYYY-MM-DD") filtran por fecha de emision;
 * "hasta" incluye el dia completo (hasta las 23:59:59.999).
 */
async function listarMisFacturas(cajero, { desde, hasta } = {}) {
  if (!cajero || !String(cajero).trim()) {
    throw new AppError("Falta identificar al cajero para listar sus facturas.", 400);
  }

  const desdeFecha = desde ? new Date(`${desde}T00:00:00`) : null;
  const hastaFecha = hasta ? new Date(`${hasta}T23:59:59.999`) : null;
  if (desde && Number.isNaN(desdeFecha.getTime())) {
    throw new AppError('El parametro "desde" no es una fecha valida.', 400);
  }
  if (hasta && Number.isNaN(hastaFecha.getTime())) {
    throw new AppError('El parametro "hasta" no es una fecha valida.', 400);
  }

  return repo.listarPorCajero(String(cajero).trim(), { desde: desdeFecha, hasta: hastaFecha });
}

/**
 * Anula una venta (Simple o Mixta) en un solo paso: requiere el usuario + PIN de
 * un supervisor de caja (validado contra facturacion) y que este dentro del
 * plazo de 2 horas desde la emision. Solo el cajero que la emitio puede pedirlo.
 */
async function anularVenta({ id_transaccion, cajero, supervisor_id, pin }) {
  if (!supervisor_id || !String(supervisor_id).trim() || !pin || !String(pin).trim()) {
    throw new AppError("Ingrese el usuario y el PIN del supervisor.", 400);
  }

  const filas = await repo.buscarTransaccionesPorIdTransaccion(id_transaccion);
  if (!filas.length) {
    throw new AppError(`No existe una venta registrada con el número "${id_transaccion}", o ya fue anulada.`, 404);
  }

  if (cajero && filas[0].cajero !== cajero) {
    throw new AppError("Solo el cajero que emitió esta venta puede solicitar su anulación.", 403);
  }

  if (!dentroDelPlazo(filas[0].fecha)) {
    throw new AppError(
      `La venta "${id_transaccion}" ya superó el plazo de 2 horas para poder anularse.`,
      409,
      { fecha_emision: filas[0].fecha }
    );
  }

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  const anuladas = await repo.anularTransaccion(id_transaccion, { anulado_por: supervisor.supervisor_id });
  emitirActualizacion();

  return { id_transaccion, autorizado_por: supervisor, filas: anuladas };
}

/**
 * TDSI-323: reporte de ventas de una caja para el cierre de turno. "desde" es
 * obligatorio (la apertura del turno); "hasta" es opcional (por defecto, ahora).
 */
async function reporteTurno({ caja_id, desde, hasta }) {
  if (!caja_id) {
    throw new AppError("Falta 'caja_id' para generar el reporte del turno.", 400);
  }
  if (!desde) {
    throw new AppError("Falta 'desde' para generar el reporte del turno.", 400);
  }
  const desdeFecha = new Date(desde);
  const hastaFecha = hasta ? new Date(hasta) : new Date();
  if (Number.isNaN(desdeFecha.getTime())) {
    throw new AppError("'desde' no es una fecha valida.", 400);
  }
  if (Number.isNaN(hastaFecha.getTime())) {
    throw new AppError("'hasta' no es una fecha valida.", 400);
  }
  return repo.reporteTurno(caja_id, desdeFecha, hastaFecha);
}

/**
 * TDSI-327: historial de compras de un cliente (NIT o CI), para el buscador de
 * clientes del administrador -- cuantas veces vino y que ha facturado.
 */
async function historialCliente(tipo_documento, numero) {
  const errorFormato = validarFormatoDocumento(tipo_documento, numero);
  if (errorFormato) {
    throw new AppError(errorFormato, 400);
  }

  const numeroLimpio = String(numero).trim();
  const facturas = await repo.historialPorDocumento(tipo_documento, numeroLimpio);
  if (!facturas.length) {
    throw new AppError(`No se encontraron compras para ese ${tipo_documento}.`, 404, { tipo_documento, numero: numeroLimpio });
  }

  const vigentes = facturas.filter((f) => f.estado !== "Anulado");

  return {
    tipo_documento,
    numero: numeroLimpio,
    razon_social: facturas[0].razon_social,
    cantidadCompras: vigentes.length,
    totalGastado: vigentes.reduce((acc, f) => acc + f.total, 0),
    cantidadAnuladas: facturas.length - vigentes.length,
    facturas,
  };
}

/**
 * TDSI-328: total ganado por el negocio desde el inicio (todas las cajas), para
 * el tablero del administrador. "desde"/"hasta" opcionales (por defecto, todo el historico).
 */
async function totalesGenerales({ desde, hasta } = {}) {
  const desdeFecha = desde ? new Date(`${desde}T00:00:00`) : new Date(0);
  const hastaFecha = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date();
  if (Number.isNaN(desdeFecha.getTime())) {
    throw new AppError('El parametro "desde" no es una fecha valida.', 400);
  }
  if (Number.isNaN(hastaFecha.getTime())) {
    throw new AppError('El parametro "hasta" no es una fecha valida.', 400);
  }
  return repo.totalesGenerales(desdeFecha, hastaFecha);
}

/** TDSI-329: lista de cajeros con al menos una venta, para el panel de administrador. */
async function listarCajeros() {
  return repo.listarCajeros();
}

module.exports = { listarMisFacturas, anularVenta, reporteTurno, historialCliente, totalesGenerales, listarCajeros };
