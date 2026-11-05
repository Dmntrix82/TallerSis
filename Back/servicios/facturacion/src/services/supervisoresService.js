const repo = require("../data/supervisoresRepo");
const { hashSecret } = require("../utils/secretHash");
const { PIN_REGEX } = require("../config/pin");

// TDSI-55: administracion de supervisores de caja (pantalla "Supervisores").

function err(mensaje, status = 400) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

/** Texto obligatorio, recortado y con largo maximo (coincide con la tabla) */
function textoObligatorio(valor, campo, max) {
  if (typeof valor !== "string" || !valor.trim())
    throw err(`El campo '${campo}' es obligatorio`);
  const t = valor.trim();
  if (t.length > max) throw err(`El campo '${campo}' admite como maximo ${max} caracteres`);
  return t;
}

function validarFormatoPin(pin) {
  if (typeof pin !== "string" || !PIN_REGEX.test(pin))
    throw err("El PIN debe tener entre 4 y 6 dígitos");
  return pin;
}

/** id de la ruta: entero positivo (BIGSERIAL de la tabla) */
function validarId(id) {
  const n = Number(id);
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(n) || n < 1)
    throw err("El id del supervisor no es valido");
  return n;
}

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

/** TDSI-721: registra un supervisor con usuario unico y PIN de 4 a 6 digitos (guardado con hash) */
async function crearSupervisor({ usuario, nombre, pin } = {}) {
  const supervisor_id = textoObligatorio(usuario, "usuario", 60);
  const nombreLimpio = textoObligatorio(nombre, "nombre", 150);
  validarFormatoPin(pin);

  const creado = await repo.crear({
    supervisor_id,
    nombre: nombreLimpio,
    pin_hash: hashSecret(pin),
  });
  if (!creado) throw err(`Ya existe un supervisor con el usuario '${supervisor_id}'`, 409);
  return aPublico(creado);
}

/** TDSI-722: "Restablecer PIN": asigna un PIN nuevo y desbloquea si estaba bloqueado */
async function restablecerPin(id, { pin } = {}) {
  const supId = validarId(id);
  validarFormatoPin(pin);

  const actualizado = await repo.actualizarPin(supId, hashSecret(pin));
  if (!actualizado) throw err("Supervisor no encontrado", 404);
  return aPublico(actualizado);
}

/** TDSI-723: "Desactivar" / "Activar"; un supervisor inactivo no puede autorizar */
async function cambiarEstadoSupervisor(id, { activo } = {}) {
  const supId = validarId(id);
  if (typeof activo !== "boolean")
    throw err("El campo 'activo' es obligatorio y debe ser true o false");

  const actualizado = await repo.cambiarEstado(supId, activo);
  if (!actualizado) throw err("Supervisor no encontrado", 404);
  return aPublico(actualizado);
}

module.exports = {
  listarSupervisores, crearSupervisor, restablecerPin, cambiarEstadoSupervisor,
  estadoDe, aPublico, validarFormatoPin, validarId,
};
