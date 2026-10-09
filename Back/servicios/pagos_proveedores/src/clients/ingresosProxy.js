const cfg = require("../config/integraciones");
const { AppError } = require("../utils/AppError");

// TDSI-415: los ingresos (ventas) viven en gestion_pagos (pagos.transacciones).
// Este servicio NO lee esa tabla directo: los pide por HTTP al endpoint
// /api/pagos/totales-generales filtrado al dia del cierre.

const num = (v) => Math.round(Number(v || 0) * 100) / 100;

/** Datos fijos para MODO_AISLADO: permiten probar el lote sin levantar gestion_pagos. */
function ingresosSimulados(fecha) {
  return {
    fecha,
    origen: "SIMULADO",
    efectivo: 850.0,
    tarjeta: 420.0,
    qr: 230.0,
    total: 1500.0,
    cantidadVentas: 12,
    cantidadAnuladas: 1,
    montoAnulado: 45.0,
  };
}

async function obtenerIngresosDelDia(fecha) {
  if (cfg.MODO_AISLADO) return ingresosSimulados(fecha);

  const params = new URLSearchParams({ desde: fecha, hasta: fecha });
  let respuesta;
  try {
    respuesta = await fetch(`${cfg.GESTION_PAGOS_URL}/api/pagos/totales-generales?${params}`, {
      signal: AbortSignal.timeout(cfg.TIMEOUT_MS),
    });
  } catch (e) {
    const motivo = e.name === "TimeoutError" ? `no respondio en ${cfg.TIMEOUT_MS} ms` : "no esta disponible";
    throw new AppError(`No se pudieron obtener los ingresos del dia: gestion_pagos ${motivo}.`, 502);
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !cuerpo || !cuerpo.data) {
    throw new AppError(
      cuerpo?.mensaje || `No se pudieron obtener los ingresos del dia (HTTP ${respuesta.status}).`,
      502
    );
  }

  const d = cuerpo.data;
  return {
    fecha,
    origen: "GESTION_PAGOS",
    efectivo: num(d.totalEfectivo),
    tarjeta: num(d.totalTarjeta),
    qr: num(d.totalQR),
    total: num(d.totalGeneral),
    cantidadVentas: d.cantidadVentas || 0,
    cantidadAnuladas: d.cantidadAnuladas || 0,
    montoAnulado: num(d.montoAnulado),
  };
}

module.exports = { obtenerIngresosDelDia };