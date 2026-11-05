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

/** TDSI-47/916: lista de supervisores para la pantalla "Usuarios" (sin PIN). */
async function listarSupervisores() {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/supervisores`);
  } catch (e) {
    throw new AppError("No se pudo obtener la lista de supervisores en este momento.", 502);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new AppError(datos?.mensaje || "No se pudo obtener la lista de supervisores.", respuesta.status, datos?.detalle);
  }

  return datos.data; // [{ usuario, nombre, estado, ... }]
}

/** TDSI-47/917: "Editar" un supervisor desde la pantalla "Usuarios" (nombre + usuario, sin PIN). */
async function editarSupervisor(id, { usuario, nombre }) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/supervisores/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, nombre }),
    });
  } catch (e) {
    throw new AppError("No se pudo editar al supervisor en este momento. Intente de nuevo.", 502);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new AppError(datos?.mensaje || "No se pudo editar al supervisor.", respuesta.status, datos?.detalle);
  }

  return datos.data;
}

/** TDSI-47/918: "Activar" / "Desactivar" un supervisor desde la pantalla "Usuarios". */
async function cambiarEstadoSupervisor(id, activo) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/supervisores/${encodeURIComponent(id)}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
  } catch (e) {
    throw new AppError("No se pudo cambiar el estado del supervisor en este momento. Intente de nuevo.", 502);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new AppError(datos?.mensaje || "No se pudo cambiar el estado del supervisor.", respuesta.status, datos?.detalle);
  }

  return datos.data;
}

module.exports = { validarSupervisor, listarSupervisores, editarSupervisor, cambiarEstadoSupervisor };
