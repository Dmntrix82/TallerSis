const repo = require("../data/supervisoresRepo");

// TDSI-55: administracion de supervisores de caja (pantalla "Supervisores").

/** Estado visible en la lista: Inactivo tiene prioridad sobre Bloqueado */
function estadoDe(sup) {
  if (!sup.activo) return "Inactivo";
  if (sup.bloqueado) return "Bloqueado";
  return "Activo";
}

/** Forma publica del supervisor: nunca incluye el PIN ni su hash */
function aPublico(sup) {
  return {
    id: Number(sup.id),
    usuario: sup.supervisor_id,
    nombre: sup.nombre,
    estado: estadoDe(sup),
    activo: sup.activo,
    bloqueado: Boolean(sup.bloqueado),
    bloqueado_hasta: sup.bloqueado_hasta,
    actualizado_en: sup.actualizado_en,
  };
}

/** TDSI-187: lista de supervisores (usuario, nombre, estado, bloqueo, fecha de actualizacion) */
async function listarSupervisores() {
  const filas = await repo.listar();
  return filas.map(aPublico);
}

module.exports = { listarSupervisores, estadoDe, aPublico };
