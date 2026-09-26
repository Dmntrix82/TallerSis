const repo = require("../data/anulacionesRepo");
const { validarPin } = require("./pinService");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

const DECISIONES = ["APROBAR", "RECHAZAR"];

/** TDSI-384 + TDSI-385: autorizar (o rechazar) una anulacion con el PIN del supervisor */
async function autorizarAnulacion(id, { supervisor_id, pin, decision, observacion } = {}) {
  const anulacionId = String(id ?? "").trim();
  if (!/^\d{1,18}$/.test(anulacionId) || Number(anulacionId) === 0)
    throw err("El id de la anulación debe ser un número entero positivo");

  const dec = typeof decision === "string" ? decision.trim().toUpperCase() : "";
  if (!DECISIONES.includes(dec))
    throw err("La decisión debe ser APROBAR o RECHAZAR");

  if (observacion != null && (typeof observacion !== "string" || observacion.length > 300))
    throw err("La observación debe ser texto de máximo 300 caracteres");

  // Se revisa antes del PIN para no gastar intentos en una solicitud que no existe
  const anulacion = await repo.buscar(anulacionId);
  if (!anulacion) throw err("Solicitud de anulación no encontrada", 404);
  if (anulacion.estado !== "Solicitada")
    throw err(`La solicitud ya fue resuelta (${anulacion.estado})`, 409);

  // El PIN se valida FUERA de la transaccion: los intentos fallidos deben quedar guardados
  const supervisor = await validarPin(supervisor_id, pin);

  if (anulacion.solicitado_por && anulacion.solicitado_por === supervisor.supervisor_id)
    throw err("Un supervisor no puede autorizar su propia solicitud de anulación", 403);

  const resultado = await repo.resolver(
    anulacionId,
    {
      aprobar: dec === "APROBAR",
      supervisor,
      observacion: observacion?.trim() || null,
    },
    (actual) => {
      if (!actual) throw err("Solicitud de anulación no encontrada", 404);
      if (actual.estado !== "Solicitada")
        throw err(`La solicitud ya fue resuelta (${actual.estado})`, 409);
    }
  );

  return {
    ...resultado,
    id: Number(resultado.id),
    factura_id: Number(resultado.factura_id),
  };
}

module.exports = { autorizarAnulacion };