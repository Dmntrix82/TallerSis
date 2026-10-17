const { AppError } = require("../utils/AppError");
const repo = require("../data/revisionRepo");
const { validarFechaDia } = require("../utils/fechaLocal");

const METODOS = ["Efectivo", "Tarjeta", "QR"];
const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const RANGO_MAXIMO_DIAS = 92;
const ESTADOS_REVISION = ["REVISADA", "OBSERVADA"];
const FILTROS_REVISION = ["PENDIENTE", ...ESTADOS_REVISION];
const NOTA_MAXIMA = 300;

function validarCajeroId(valor) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) throw new AppError("El campo 'cajero_id' es obligatorio.", 400);
  if (texto.length > 60) throw new AppError("El campo 'cajero_id' admite hasta 60 caracteres.", 400, { cajero_id: valor });
  return texto;
}

/**
 * Rango de dias a revisar (inclusive). Se puede pedir un solo dia con "fecha",
 * o un rango con "desde"/"hasta". Sin nada, es el dia de hoy (hora de Bolivia).
 */
function validarRango({ fecha, desde, hasta }) {
  if (fecha) {
    const dia = validarFechaDia(fecha, "fecha");
    return { desde: dia, hasta: dia };
  }
  const d = validarFechaDia(desde, "desde");
  const h = validarFechaDia(hasta || (desde ? d : undefined), "hasta");
  if (d > h) throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'.", 400, { desde: d, hasta: h });
  const dias = (Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000 + 1;
  if (dias > RANGO_MAXIMO_DIAS) {
    throw new AppError(`El rango no puede superar ${RANGO_MAXIMO_DIAS} dias.`, 400, { desde: d, hasta: h });
  }
  return { desde: d, hasta: h };
}

/** Acepta "qr", "QR", "efectivo"...; devuelve el nombre tal como esta guardado, o null si no viene. */
function validarMetodo(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const metodo = METODOS.find((m) => m.toLowerCase() === String(valor).trim().toLowerCase());
  if (!metodo) throw new AppError(`El metodo debe ser uno de: ${METODOS.join(", ")}.`, 400, { metodo: valor });
  return metodo;
}

/** TDSI-429: filtro opcional por estado de revision (PENDIENTE = todavia sin revisar). */
function validarFiltroRevision(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const estado = String(valor).trim().toUpperCase();
  if (!FILTROS_REVISION.includes(estado)) {
    throw new AppError(`El estado de revision debe ser uno de: ${FILTROS_REVISION.join(", ")}.`, 400, { estado_revision: valor });
  }
  return estado;
}

function validarEnteroPositivo(valor, campo, defecto, maximo = Number.MAX_SAFE_INTEGER) {
  if (valor === undefined || valor === null || valor === "") return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > maximo) {
    throw new AppError(`El campo '${campo}' debe ser un entero entre 1 y ${maximo}.`, 400, { [campo]: valor });
  }
  return n;
}

/**
 * TDSI-427: transacciones de un cajero para que el Supervisor de Caja las revise.
 * Filtros: cajero_id (obligatorio), fecha o desde/hasta, metodo (opcional).
 * Paginacion: pagina (desde 1) y por_pagina (por defecto 20, maximo 100).
 */
async function listarTransaccionesPorCajero({ cajero_id, fecha, desde, hasta, metodo, estado_revision, pagina, por_pagina } = {}) {
  const cajeroId = validarCajeroId(cajero_id);
  const rango = validarRango({ fecha, desde, hasta });
  const metodoFiltro = validarMetodo(metodo);
  const revisionFiltro = validarFiltroRevision(estado_revision);
  const paginaN = validarEnteroPositivo(pagina, "pagina", 1);
  const porPaginaN = validarEnteroPositivo(por_pagina, "por_pagina", POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO);

  const { total, filas } = await repo.listarTransaccionesCajero({
    cajeroId,
    ...rango,
    metodo: metodoFiltro,
    estadoRevision: revisionFiltro,
    limite: porPaginaN,
    offset: (paginaN - 1) * porPaginaN,
  });

  return {
    cajero_id: cajeroId,
    filtros: { ...rango, metodo: metodoFiltro, estado_revision: revisionFiltro },
    paginacion: {
      pagina: paginaN,
      por_pagina: porPaginaN,
      total_registros: total,
      total_paginas: Math.ceil(total / porPaginaN),
    },
    transacciones: filas.map((f) => ({
      id_transaccion: f.id_transaccion,
      fecha: f.fecha,
      fecha_local: f.fecha_local,
      hora: f.hora,
      caja_id: f.caja_id,
      tipo_pago: f.tipo_pago,
      metodos: f.metodos,
      detalle_metodos: f.detalle_metodos,
      total: f.total,
      estado: f.estado,
      tipo_documento: f.tipo_documento,
      nit: f.nit,
      razon_social: f.razon_social,
      revision: {
        estado: f.revision_estado,
        nota: f.revision_nota,
        revisado_por: f.revision_revisado_por,
        revisado_en: f.revision_revisado_en,
      },
    })),
  };
}

/**
 * TDSI-428: resumen del cajero en el rango (fecha o desde/hasta, por defecto hoy):
 * cantidad de transacciones por estado, total cobrado (solo APROBADAS) y
 * cantidad y total por metodo. Siempre trae los 3 metodos, aunque esten en 0.
 */
async function obtenerResumenCajero({ cajero_id, fecha, desde, hasta } = {}) {
  const cajeroId = validarCajeroId(cajero_id);
  const rango = validarRango({ fecha, desde, hasta });

  const r = await repo.resumenCajero({ cajeroId, ...rango });
  const porMetodo = METODOS.map((metodo) => r.por_metodo.find((m) => m.metodo === metodo) || { metodo, cantidad: 0, total: 0 });

  return {
    cajero_id: cajeroId,
    cajero: r.cajero,
    filtros: rango,
    cantidad_transacciones: r.cantidad_transacciones,
    cantidad_aprobadas: r.cantidad_aprobadas,
    cantidad_anuladas: r.cantidad_anuladas,
    cantidad_rechazadas: r.cantidad_rechazadas,
    cantidad_pendientes: r.cantidad_pendientes,
    total: r.total,
    total_anulado: r.total_anulado,
    primera_operacion: r.primera_operacion,
    ultima_operacion: r.ultima_operacion,
    revision: r.revision,
    por_metodo: porMetodo,
  };
}

/**
 * TDSI-131: cajeros con ventas en el rango (fecha o desde/hasta, por defecto hoy),
 * con cuantas transacciones tienen, el total cobrado y cuantas faltan revisar.
 */
async function listarCajerosParaRevision({ fecha, desde, hasta } = {}) {
  const rango = validarRango({ fecha, desde, hasta });
  const cajeros = await repo.listarCajerosConVentas(rango);
  return { filtros: rango, total: cajeros.length, cajeros };
}

/**
 * TDSI-429: el Supervisor de Caja marca una venta como REVISADA u OBSERVADA.
 *   - OBSERVADA exige una nota (que se observo); en REVISADA la nota es opcional.
 *   - revisado_por: quien hizo la revision (obligatorio, para trazabilidad).
 *   - Se puede volver a marcar: queda la ultima revision.
 * 404 si la venta no existe.
 */
async function marcarRevision({ id_transaccion, estado, nota, revisado_por } = {}) {
  const id = String(id_transaccion ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) {
    throw new AppError("El id de la transaccion no tiene un formato valido.", 400, { id_transaccion });
  }
  const estadoNuevo = typeof estado === "string" ? estado.trim().toUpperCase() : "";
  if (!ESTADOS_REVISION.includes(estadoNuevo)) {
    throw new AppError(`El estado debe ser ${ESTADOS_REVISION.join(" u ")}.`, 400, { estado });
  }
  if (nota !== undefined && nota !== null && typeof nota !== "string") {
    throw new AppError("La nota debe ser texto.", 400);
  }
  const notaLimpia = typeof nota === "string" && nota.trim() ? nota.trim() : null;
  if (notaLimpia && notaLimpia.length > NOTA_MAXIMA) {
    throw new AppError(`La nota admite hasta ${NOTA_MAXIMA} caracteres.`, 400);
  }
  if (estadoNuevo === "OBSERVADA" && !notaLimpia) {
    throw new AppError("Para marcar una transaccion como OBSERVADA debe escribir una nota.", 400);
  }
  const revisadoPor = typeof revisado_por === "string" ? revisado_por.trim() : "";
  if (!revisadoPor) throw new AppError("El campo 'revisado_por' es obligatorio.", 400);
  if (revisadoPor.length > 60) throw new AppError("El campo 'revisado_por' admite hasta 60 caracteres.", 400);

  const venta = await repo.buscarVenta(id);
  if (!venta) throw new AppError(`La transaccion "${id}" no existe.`, 404, { id_transaccion: id });

  const revision = await repo.guardarRevision({ idTransaccion: id, estado: estadoNuevo, nota: notaLimpia, revisadoPor });
  return { ...revision, cajero_id: venta.cajero_id, total: venta.total };
}

module.exports = {
  METODOS,
  ESTADOS_REVISION,
  validarCajeroId,
  validarRango,
  validarMetodo,
  validarEnteroPositivo,
  listarTransaccionesPorCajero,
  obtenerResumenCajero,
  listarCajerosParaRevision,
  marcarRevision,
};