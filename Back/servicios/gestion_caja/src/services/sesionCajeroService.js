const sesionesRepo = require("../data/sesionesRepo");

/** TDSI-267: registra el inicio de sesion del cajero para auditoria */
async function registrarInicioSesion({ cajero_id, cajero_nombre, caja_id }) {
  return sesionesRepo.insertarSesion({ cajero_id, cajero_nombre, caja_id });
}

module.exports = { registrarInicioSesion };
