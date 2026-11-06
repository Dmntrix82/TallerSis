const sesionesRepo = require("../data/sesionesRepo");

const MINUTOS_INACTIVIDAD = Number(process.env.SESSION_INACTIVITY_MINUTES) || 15;
const { verificarContrasena } = require("./authService");


/** TDSI-267: registra el inicio de sesion del cajero para auditoria */
async function registrarInicioSesion({ cajero_id, cajero_nombre, caja_id }) {
  return sesionesRepo.insertarSesion({ cajero_id, cajero_nombre, caja_id });
}

/** TDSI-268: cierra automaticamente las sesiones que llevan abiertas mas de MINUTOS_INACTIVIDAD */
async function cerrarSesionesInactivas() {
  return sesionesRepo.cerrarInactivas(MINUTOS_INACTIVIDAD);
}

/** TDSI-183/851/852: desbloquea la pantalla verificando la contraseña. */
async function desbloquear({ cajero_id, email, password }) {
  const sesion = await sesionesRepo.obtenerSesionActiva(cajero_id);
  if (!sesion) throw new Error("No hay sesión activa para este cajero.");

  if (sesion.intentos_desbloqueo >= 3) {
    // TDSI-851: ya falló 3 veces, la sesión está cerrada
    throw new Error("Demasiados intentos fallidos. Inicie sesión nuevamente.");
  }

  const esValida = await verificarContrasena(email, password);
  if (!esValida) {
    // TDSI-851: incrementar intentos y cerrar al 3ero
    const intentos = await sesionesRepo.incrementarIntentos(sesion.id);
    if (intentos >= 3) {
      await sesionesRepo.cerrarSesion(sesion.id);
      throw new Error("Demasiados intentos fallidos. Sesión cerrada.");
    }
    throw new Error("Contraseña incorrecta.");
  }

  // Desbloqueo exitoso
  return sesionesRepo.desbloquearSesion(sesion.id);
}

module.exports = { registrarInicioSesion, cerrarSesionesInactivas, desbloquear, MINUTOS_INACTIVIDAD };
