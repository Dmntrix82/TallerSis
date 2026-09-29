const { AppError } = require("../utils/AppError");
const repo = require("../data/tableroRepo");
const pagosRepo = require("../data/pagosRepo");

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

/** TDSI-330: que caja, que cajero y que cliente generan mas (historico completo). */
async function obtenerRankings() {
  const [cajas, cajeros, clientes] = await Promise.all([
    pagosRepo.rankingCajas(),
    pagosRepo.rankingCajeros(), // sin limite: "todos los cajeros que hay"
    pagosRepo.rankingClientes(10),
  ]);
  return { cajas, cajeros, clientes };
}

/** TDSI-331: serie de los ultimos N dias (incluye dias en 0), para el grafico de montanas. */
async function obtenerSerieDiaria(dias = 14) {
  const n = Math.min(Math.max(Number(dias) || 14, 1), 90);
  const hoy = hoyLocal();
  const base = new Date(`${hoy}T00:00:00`);

  const fechas = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    fechas.push(d.toLocaleDateString("en-CA"));
  }

  const totales = await Promise.all(fechas.map((f) => repo.totalPorFecha(f)));
  return fechas.map((fecha, i) => ({ fecha, total: totales[i] }));
}

module.exports = { obtenerIngresosDelDia, obtenerRankings, obtenerSerieDiaria };
