const repo = require("../data/tableroRepo");

// TDSI-376: no hay HU que pida gestionar multiples sucursales aun, solo existe esta.
const SUCURSAL = "Sucursal Central";

/** TDSI-111/375/376: consolida los ingresos fisicos y virtuales del dia, con totales y desglose por caja */
async function obtenerIngresosDelDia() {
  const [fisico, virtual, porCaja] = await Promise.all([
    repo.totalIngresosFisicosHoy(),
    repo.totalIngresosVirtualesHoy(),
    repo.totalesPorCajaHoy(),
  ]);

  return {
    fecha: new Date().toISOString().slice(0, 10),
    sucursal: SUCURSAL,
    fisico,
    virtual,
    total_general: fisico.total + virtual.total,
    porCaja,
  };
}

module.exports = { obtenerIngresosDelDia };
