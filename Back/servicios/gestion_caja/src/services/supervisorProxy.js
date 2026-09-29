const { AppError } = require("../utils/AppError");

// El registro real de supervisores (con PIN, bloqueo tras intentos fallidos) vive en
// facturacion; gestion_caja NUNCA lo duplica, solo consulta por HTTP -- mismo patron
// que clientesProxy.js en gestion_pagos.
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

/** Valida el usuario + PIN del supervisor que autoriza abrir el terminal. */
async function validarSupervisor({ supervisor_id, pin }) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/supervisores/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisor_id, pin }),
    });
  } catch (e) {
    throw new AppError("No se pudo validar al supervisor en este momento. Intente de nuevo.", 502);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new AppError(datos?.mensaje || "Supervisor o PIN incorrecto.", respuesta.status, datos?.detalle);
  }

  return datos.data; // { supervisor_id, nombre }
}

module.exports = { validarSupervisor };
