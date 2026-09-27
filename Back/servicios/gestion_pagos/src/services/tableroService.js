const { AppError } = require("../utils/AppError");
const repo = require("../data/tableroRepo");

// TDSI-376: no hay HU que pida gestionar multiples sucursales aun, solo existe esta.
const SUCURSAL = "Sucursal Central";
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function hoyLocal() {
  // Mismo huso horario que usa el resto del sistema (America/La_Paz).
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
}

/** TDSI-381: valida el filtro de fecha; sin fecha (o invalida) usa el dia de hoy. */
function validarFecha(fecha) {
  if (!fecha) return hoyLocal();
  if (!FECHA_REGEX.test(fecha)) {
    throw new AppError("El campo 'fecha' debe tener formato YYYY-MM-DD.", 400, { fecha });
  }
  return fecha;
}

/** TDSI-111/375/376: consolida los ingresos fisicos y virtuales del dia, con totales y desglose por caja */
/** TDSI-381: admite filtrar por una fecha especifica; sin ella, es el dia de hoy (comportamiento previo) */
async function obtenerIngresosDelDia(fecha) {
  const fechaValida = validarFecha(fecha);

  const [fisico, virtual, porCaja] = await Promise.all([
    repo.totalIngresosFisicosEnFecha(fechaValida),
    repo.totalIngresosVirtualesEnFecha(fechaValida),
    repo.totalesPorCajaEnFecha(fechaValida),
  ]);

  return {
    fecha: fechaValida,
    sucursal: SUCURSAL,
    fisico,
    virtual,
    total_general: fisico.total + virtual.total,
    porCaja,
  };
}

module.exports = { obtenerIngresosDelDia };
