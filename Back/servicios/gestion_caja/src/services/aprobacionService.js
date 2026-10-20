const { AppError } = require("../utils/AppError");
const repo = require("../data/aprobacionesRepo");
const turnosRepo = require("../data/turnosRepo");
const { validarSupervisor } = require("./supervisorProxy");

// TDSI-35: operaciones de caja que necesitan la aprobacion del supervisor.
const TIPOS = {
  RETIRO_EFECTIVO: "Retiro de efectivo de la caja",
  DESCUENTO_ESPECIAL: "Descuento fuera de lo permitido al cajero",
  VENTA_MONTO_ALTO: "Venta por encima del monto permitido",
  CAMBIO_METODO_PAGO: "Cambio del metodo de pago de una venta",
  REIMPRESION_FACTURA: "Reimpresion de una factura",
  OTRO: "Otra operacion que requiere aprobacion",
};
const ESTADOS = ["PENDIENTE", "APROBADA", "RECHAZADA"];
const MAX_TEXTO = 300;

/** Texto obligatorio, sin espacios sobrantes y con largo maximo. */
function textoObligatorio(valor, campo, max) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new AppError(`El campo '${campo}' es obligatorio`, 400);
  if (texto.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres`, 400, { [campo]: valor });
  return texto;
}

/** Valor de un catalogo (acepta minusculas); null si no viene y no es obligatorio. */
function deCatalogo(valor, campo, permitidos, obligatorio = false) {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw new AppError(`El campo '${campo}' es obligatorio`, 400);
    return null;
  }
  const v = String(valor).trim().toUpperCase();
  if (!permitidos.includes(v)) {
    throw new AppError(`El campo '${campo}' debe ser uno de: ${permitidos.join(", ")}`, 400, { [campo]: valor });
  }
  return v;
}

function validarId(id) {
  if (!/^\d+$/.test(String(id))) throw new AppError("Id de solicitud invalido", 400, { id });
  return Number(id);
}

/** TDSI-35: catalogo de tipos, para el selector del formulario y los filtros. */
function listarTipos() {
  return Object.entries(TIPOS).map(([codigo, descripcion]) => ({ codigo, descripcion }));
}

/**
 * TDSI-475: el cajero registra una operacion especial de su turno. Queda PENDIENTE hasta que
 * el supervisor la resuelva. El turno tiene que existir y estar ABIERTO; la caja sale del turno.
 */
async function solicitar({ turno_id, tipo, descripcion, monto, solicitado_por, solicitado_por_nombre } = {}) {
  if (turno_id === undefined || turno_id === null || turno_id === "") throw new AppError("El campo 'turno_id' es obligatorio", 400);
  if (!/^\d+$/.test(String(turno_id))) throw new AppError("El campo 'turno_id' debe ser un numero", 400, { turno_id });
  const tipoOk = deCatalogo(tipo, "tipo", Object.keys(TIPOS), true);
  const descripcionOk = textoObligatorio(descripcion, "descripcion", MAX_TEXTO);
  const solicitante = textoObligatorio(solicitado_por, "solicitado_por", 60);

  let montoOk = null;
  if (monto !== undefined && monto !== null && monto !== "") {
    montoOk = Number(monto);
    if (!Number.isFinite(montoOk) || montoOk <= 0) throw new AppError("El 'monto' debe ser un numero mayor a 0", 400, { monto });
    montoOk = Math.round(montoOk * 100) / 100;
  }

  const turno = await turnosRepo.obtenerTurnoPorId(Number(turno_id));
  if (!turno) throw new AppError("Turno no encontrado", 404, { turno_id });
  if (turno.estado !== "ABIERTO") throw new AppError("El turno ya esta cerrado", 409, { turno_id });

  return repo.crear({
    turno_id: Number(turno_id),
    caja_id: turno.caja_id,
    tipo: tipoOk,
    descripcion: descripcionOk,
    monto: montoOk,
    solicitado_por: solicitante,
    solicitado_por_nombre: typeof solicitado_por_nombre === "string" ? solicitado_por_nombre.trim() || null : null,
  });
}

/**
 * TDSI-476: el supervisor aprueba o rechaza con su usuario + PIN (validado en facturacion).
 * Queda guardado quien resolvio, a que hora (resuelto_en) y el motivo: opcional al aprobar,
 * obligatorio al rechazar.
 */
async function resolver(id, accion, { supervisor_id, pin, motivo } = {}) {
  const idOk = validarId(id);
  if (!supervisor_id || !pin) throw new AppError("Faltan 'supervisor_id' y 'pin'", 400);
  const rechazar = accion === "RECHAZAR";
  const motivoOk = rechazar
    ? textoObligatorio(motivo, "motivo", MAX_TEXTO)
    : typeof motivo === "string" && motivo.trim()
      ? textoObligatorio(motivo, "motivo", MAX_TEXTO)
      : null;

  const solicitud = await repo.obtenerPorId(idOk);
  if (!solicitud) throw new AppError("Solicitud no encontrada", 404, { id });
  if (solicitud.estado !== "PENDIENTE") {
    throw new AppError(`La solicitud ya esta ${solicitud.estado}`, 409, { estado: solicitud.estado });
  }

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  const resuelta = await repo.resolver(idOk, {
    estado: rechazar ? "RECHAZADA" : "APROBADA",
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
    motivo: motivoOk,
  });
  // Otro supervisor la resolvio entre la lectura y la actualizacion.
  if (!resuelta) throw new AppError("La solicitud ya fue resuelta por otro supervisor", 409, { id });
  return resuelta;
}

const aprobar = (id, datos) => resolver(id, "APROBAR", datos);
const rechazar = (id, datos) => resolver(id, "RECHAZAR", datos);

/** TDSI-477: bandeja del supervisor con filtros por estado, tipo y caja. */
async function listar({ estado, tipo, caja_id } = {}) {
  const filtros = {
    estado: deCatalogo(estado, "estado", ESTADOS),
    tipo: deCatalogo(tipo, "tipo", Object.keys(TIPOS)),
    caja_id: typeof caja_id === "string" && caja_id.trim() ? caja_id.trim() : null,
  };
  const data = await repo.listar(filtros);
  return {
    filtros,
    total: data.length,
    pendientes: data.filter((a) => a.estado === "PENDIENTE").length,
    data,
  };
}

async function obtener(id) {
  const solicitud = await repo.obtenerPorId(validarId(id));
  if (!solicitud) throw new AppError("Solicitud no encontrada", 404, { id });
  return solicitud;
}

module.exports = { TIPOS, ESTADOS, listarTipos, solicitar, aprobar, rechazar, listar, obtener };
