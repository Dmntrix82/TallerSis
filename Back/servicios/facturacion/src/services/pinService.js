const crypto = require("crypto");
const repo = require("../data/supervisoresRepo");
const { hashSecret, verificarSecret } = require("../utils/secretHash");
const { MAX_INTENTOS, BLOQUEO_MIN, PIN_REGEX } = require("../config/pin");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

// Para que un supervisor inexistente tarde lo mismo que un PIN incorrecto
const HASH_FICTICIO = hashSecret(crypto.randomBytes(8).toString("hex"));

function minutosRestantes(fecha) {
  return Math.max(1, Math.ceil((new Date(fecha).getTime() - Date.now()) / 60000));
}

/** TDSI-383 + TDSI-386: valida el PIN, con bloqueo tras varios fallos seguidos */
async function validarPin(supervisor_id, pin) {
  if (typeof supervisor_id !== "string" || !supervisor_id.trim())
    throw err("El campo 'supervisor_id' es obligatorio");
  if (typeof pin !== "string" || !PIN_REGEX.test(pin))
    throw err("El PIN debe tener entre 4 y 6 dígitos");

  const id = supervisor_id.trim();
  const sup = await repo.buscar(id);

  if (!sup || !sup.activo) {
    verificarSecret(pin, HASH_FICTICIO);
    throw err("Supervisor o PIN incorrecto", 401);
  }

  if (sup.bloqueado) {
    throw err(
      `Supervisor bloqueado por intentos fallidos. Intente en ${minutosRestantes(sup.bloqueado_hasta)} minuto(s)`,
      423,
      { bloqueado_hasta: sup.bloqueado_hasta }
    );
  }

  if (!verificarSecret(pin, sup.pin_hash)) {
    const r = await repo.registrarFallo(id, MAX_INTENTOS, BLOQUEO_MIN);
    if (r.bloqueado) {
      throw err(
        `PIN incorrecto. Supervisor bloqueado por ${BLOQUEO_MIN} minutos`,
        423,
        { bloqueado_hasta: r.bloqueado_hasta }
      );
    }
    throw err("Supervisor o PIN incorrecto", 401, {
      intentos_restantes: MAX_INTENTOS - r.intentos_fallidos,
    });
  }

  if (sup.intentos_fallidos > 0) await repo.reiniciarIntentos(id);
  return { supervisor_id: sup.supervisor_id, nombre: sup.nombre };
}

module.exports = { validarPin };