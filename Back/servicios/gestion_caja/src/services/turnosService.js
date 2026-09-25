const repo = require("../data/turnosRepo");
const { AppError } = require("../utils/AppError");

const MONTO_MAXIMO = 999999999999.99; // límite de NUMERIC(14,2)

function validarEfectivoInicial(valor) {
  if (valor === undefined || valor === null || valor === "")
    throw new AppError("El campo 'efectivo_inicial' es obligatorio");

  const monto = Number(valor);
  if (Number.isNaN(monto) || !Number.isFinite(monto))
    throw new AppError("El efectivo inicial debe ser un número válido", 400, { efectivo_inicial: valor });
  if (monto < 0)
    throw new AppError("El efectivo inicial no puede ser negativo", 400, { efectivo_inicial: monto });
  if (monto > MONTO_MAXIMO)
    throw new AppError("El efectivo inicial supera el monto máximo permitido", 400, { efectivo_inicial: monto });
  if (!/^\d+(\.\d{1,2})?$/.test(String(valor).trim()))
    throw new AppError("El efectivo inicial debe tener como máximo 2 decimales", 400, { efectivo_inicial: valor });

  return Math.round(monto * 100) / 100;
}

function validarTexto(valor, campo, max) {
  if (!valor || typeof valor !== "string" || !valor.trim())
    throw new AppError(`El campo '${campo}' es obligatorio y debe ser texto`);
  const limpio = valor.trim();
  if (limpio.length > max) throw new AppError(`El campo '${campo}' no puede superar ${max} caracteres`);
  return limpio;
}

/** TDSI-311 + TDSI-312: registrar monto inicial y guardar fecha, hora y cajero */
async function abrirTurno({ caja_id, cajero_id, efectivo_inicial } = {}) {
  const cajaId = validarTexto(caja_id, "caja_id", 20);
  const cajeroId = validarTexto(cajero_id, "cajero_id", 60);
  const monto = validarEfectivoInicial(efectivo_inicial);

  const caja = await repo.buscarCajaPorCodigo(cajaId);
  if (!caja) throw new AppError("La caja no existe", 404, { caja_id: cajaId });
  if (caja.estado !== "ACTIVA") throw new AppError("La caja está inactiva", 409, { caja_id: cajaId });

  const turno = await repo.crearTurno({
    caja_id: cajaId,
    cajero_id: cajeroId,
    efectivo_inicial: monto,
  });

  return {
    ...turno,
    id: Number(turno.id),
    efectivo_inicial: Number(turno.efectivo_inicial),
  };
}

module.exports = { abrirTurno };