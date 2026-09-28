const sesionesRepo = require("../data/sesionesRepo");

const MINUTOS_INACTIVIDAD = Number(process.env.SESSION_INACTIVITY_MINUTES) || 15;

/** TDSI-267: registra el inicio de sesion del cajero para auditoria */
async function registrarInicioSesion({ cajero_id, cajero_nombre, caja_id }) {
  return sesionesRepo.insertarSesion({ cajero_id, cajero_nombre, caja_id });
}

/** TDSI-268: cierra automaticamente las sesiones que llevan abiertas mas de MINUTOS_INACTIVIDAD */
async function cerrarSesionesInactivas() {
  return sesionesRepo.cerrarInactivas(MINUTOS_INACTIVIDAD);
}

module.exports = { registrarInicioSesion, cerrarSesionesInactivas, MINUTOS_INACTIVIDAD };
