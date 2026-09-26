const repo = require("../data/tableroRepo");

/** TDSI-111/375: consolida los ingresos fisicos y virtuales del dia en un solo tablero */
async function obtenerIngresosDelDia() {
  const [fisico, virtual] = await Promise.all([
    repo.totalIngresosFisicosHoy(),
    repo.totalIngresosVirtualesHoy(),
  ]);

  return {
    fecha: new Date().toISOString().slice(0, 10),
    fisico,
    virtual,
    total_general: fisico.total + virtual.total,
  };
}

module.exports = { obtenerIngresosDelDia };
