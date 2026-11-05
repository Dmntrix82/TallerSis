const { AppError } = require("../utils/AppError");
const repo = require("../data/operacionesEspecialesRepo");
const turnosRepo = require("../data/turnosRepo");
const { validarSupervisor } = require("./supervisorProxy");

// TDSI-62/201: operaciones de caja que necesitan la autorizacion de un supervisor.
const TIPOS = {
  RETIRO_EFECTIVO: "Retiro de efectivo de la caja",
  DESCUENTO_ESPECIAL: "Descuento fuera de lo permitido al cajero",
  VENTA_MONTO_ALTO: "Venta por encima del monto permitido",
  CAMBIO_METODO_PAGO: "Cambio del metodo de pago de una venta",
  REIMPRESION_FACTURA: "Reimpresion de una factura",
  OTRO: "Otra operacion que requiere autorizacion",
};
const MAX_TEXTO = 300;

function textoObligatorio(valor, campo, max) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new AppError(`El campo '${campo}' es obligatorio`, 400);
  if (texto.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres`, 400, { [campo]: valor });
  return texto;
}

function deCatalogo(valor, campo, permitidos) {
  const v = typeof valor === "string" ? valor.trim().toUpperCase() : "";
  if (!permitidos.includes(v)) {
    throw new AppError(`El campo '${campo}' debe ser uno de: ${permitidos.join(", ")}`, 400, { [campo]: valor });
  }
  return v;
}

/** TDSI-62: catalogo de tipos, para el selector del formulario. */
function listarTipos() {
  return Object.entries(TIPOS).map(([codigo, descripcion]) => ({ codigo, descripcion }));
}

/**
 * TDSI-62/201/955: el cajero pide la operacion y el supervisor la autoriza ahi
 * mismo con su usuario + PIN -- igual que abrir/cerrar caja o anular una
 * factura. No hay solicitud pendiente ni bandeja de espera: si el PIN no se
 * valida, no se guarda nada.
 */
async function registrar({ turno_id, tipo, descripcion, monto, cajero_id, cajero_nombre, supervisor_id, pin } = {}) {
  if (turno_id === undefined || turno_id === null || turno_id === "" || !/^\d+$/.test(String(turno_id))) {
    throw new AppError("El campo 'turno_id' es obligatorio y debe ser un numero", 400, { turno_id });
  }
  const tipoOk = deCatalogo(tipo, "tipo", Object.keys(TIPOS));
  const descripcionOk = textoObligatorio(descripcion, "descripcion", MAX_TEXTO);
  const cajeroId = textoObligatorio(cajero_id, "cajero_id", 60);

  let montoOk = null;
  if (monto !== undefined && monto !== null && monto !== "") {
    montoOk = Number(monto);
    if (!Number.isFinite(montoOk) || montoOk <= 0) throw new AppError("El 'monto' debe ser un numero mayor a 0", 400, { monto });
    montoOk = Math.round(montoOk * 100) / 100;
  }

  if (!supervisor_id || !pin) {
    throw new AppError("Se necesita el usuario y el PIN de un supervisor para autorizar esta operacion.", 400);
  }

  const turno = await turnosRepo.obtenerTurnoPorId(Number(turno_id));
  if (!turno) throw new AppError("Turno no encontrado", 404, { turno_id });
  if (turno.estado !== "ABIERTO") throw new AppError("El turno ya esta cerrado", 409, { turno_id });

  const supervisor = await validarSupervisor({ supervisor_id, pin });

  return repo.crear({
    turno_id: Number(turno_id),
    caja_id: turno.caja_id,
    tipo: tipoOk,
    descripcion: descripcionOk,
    monto: montoOk,
    solicitado_por: cajeroId,
    solicitado_por_nombre: typeof cajero_nombre === "string" && cajero_nombre.trim() ? cajero_nombre.trim() : null,
    autorizado_por: supervisor.supervisor_id,
    autorizado_por_nombre: supervisor.nombre,
  });
}

/** TDSI-62/957: historial con filtro opcional por tipo, caja y supervisor que autorizo. */
async function listar({ tipo, caja_id, supervisor_id } = {}) {
  const filtros = {
    tipo: tipo ? deCatalogo(tipo, "tipo", Object.keys(TIPOS)) : null,
    caja_id: typeof caja_id === "string" && caja_id.trim() ? caja_id.trim() : null,
    autorizado_por: typeof supervisor_id === "string" && supervisor_id.trim() ? supervisor_id.trim() : null,
  };
  const data = await repo.listar(filtros);
  return { filtros, total: data.length, data };
}

async function obtener(id) {
  if (!/^\d+$/.test(String(id))) throw new AppError("Id invalido", 400, { id });
  const operacion = await repo.obtenerPorId(Number(id));
  if (!operacion) throw new AppError("Operacion no encontrada", 404, { id });
  return operacion;
}

module.exports = { TIPOS, listarTipos, registrar, listar, obtener };
