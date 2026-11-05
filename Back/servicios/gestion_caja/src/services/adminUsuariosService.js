const { AppError } = require("../utils/AppError");
const cajerosRepo = require("../data/cajerosRepo");
const { listarSupervisores, editarSupervisor } = require("./supervisorProxy");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * TDSI-47/171: crea la cuenta de login en Supabase Auth -- ahi se guarda la
 * contrasena (encriptada, nunca en nuestra BD), igual que con el login que ya
 * existe hoy. Requiere SUPABASE_SERVICE_ROLE_KEY (API de administracion).
 */
async function crearCuentaSupabase({ email, password }) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const datos = await r.json();
  if (!r.ok) {
    const mensaje = datos.msg || datos.error_description || datos.message || "No se pudo crear la cuenta.";
    if (r.status === 422 && /already.*registered|already exists/i.test(mensaje)) {
      throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
    }
    throw new AppError(mensaje, r.status >= 400 && r.status < 500 ? 400 : 502);
  }
  return datos;
}

/**
 * TDSI-47/917: PUT /auth/v1/admin/users/:id generico (cambia email y/o contrasena).
 */
async function actualizarCuentaSupabase(cajero_id, payload) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${cajero_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const datos = await r.json();
  if (!r.ok) {
    const mensaje = datos.msg || datos.error_description || datos.message || "No se pudo actualizar la cuenta.";
    if (r.status === 422 && /already.*registered|already exists/i.test(mensaje)) {
      throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: payload.email });
    }
    throw new AppError(mensaje, r.status >= 400 && r.status < 500 ? 400 : 502);
  }
  return datos;
}

function aPublico(cajero) {
  return {
    id: cajero.cajero_id,
    cajero_id: cajero.cajero_id,
    usuario: cajero.usuario,
    nombre: cajero.nombre,
    rol: "Cajero",
    estado: cajero.activo ? "Activo" : "Inactivo",
  };
}

/**
 * TDSI-47/171: el Administrador registra un cajero nuevo. "usuario" es el
 * correo con el que va a iniciar sesion (igual que hoy); la contrasena la
 * pone el Administrador y Supabase la guarda encriptada, nunca se vuelve a
 * mostrar. El nombre/usuario/estado del cajero se guardan en caja.cajeros,
 * con el mismo patron que caja.administradores.
 */
async function crearCajero({ usuario, password, nombre }) {
  if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
    throw new AppError("El usuario debe ser un correo valido.", 400);
  }
  if (!password || String(password).length < 6) {
    throw new AppError("La contrasena debe tener al menos 6 caracteres.", 400);
  }
  if (!nombre || !String(nombre).trim()) {
    throw new AppError("El nombre es obligatorio.", 400);
  }

  const email = String(usuario).trim().toLowerCase();

  const yaExiste = await cajerosRepo.buscarPorUsuario(email);
  if (yaExiste) {
    throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
  }

  const cuenta = await crearCuentaSupabase({ email, password });
  const cajero = await cajerosRepo.crear({ cajero_id: cuenta.id, usuario: email, nombre: String(nombre).trim() });
  return aPublico(cajero);
}

/**
 * TDSI-47/916: lista unificada para la pantalla "Usuarios" -- cajeros (perfil local
 * en caja.cajeros) y supervisores (vía proxy a facturacion), sin contrasenas ni PIN.
 * El filtro por rol lo hace el Front sobre esta misma lista.
 */
async function listarUsuarios() {
  const [cajeros, supervisores] = await Promise.all([
    cajerosRepo.listar(),
    listarSupervisores(),
  ]);

  const filasCajeros = cajeros.map((c) => ({
    id: c.cajero_id,
    usuario: c.usuario,
    nombre: c.nombre,
    rol: "Cajero",
    estado: c.activo ? "Activo" : "Inactivo",
  }));
  const filasSupervisores = supervisores.map((s) => ({
    id: s.id,
    usuario: s.usuario,
    nombre: s.nombre,
    rol: "Supervisor",
    estado: s.estado,
  }));

  return [...filasCajeros, ...filasSupervisores];
}

/**
 * TDSI-47/917: "Editar" en la pantalla "Usuarios" -- cambia nombre y usuario,
 * para un cajero o un supervisor (el id de la fila alcanza para distinguirlos:
 * si existe como cajero_id en caja.cajeros, es un cajero; si no, se intenta
 * como id de supervisor en facturacion).
 */
async function editarUsuario(id, { usuario, nombre } = {}) {
  const cajero = await cajerosRepo.buscarPorCajeroId(id);
  if (cajero) {
    if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
      throw new AppError("El usuario debe ser un correo valido.", 400);
    }
    if (!nombre || !String(nombre).trim()) {
      throw new AppError("El nombre es obligatorio.", 400);
    }

    const email = String(usuario).trim().toLowerCase();
    if (email !== cajero.usuario) {
      const yaExiste = await cajerosRepo.buscarPorUsuario(email);
      if (yaExiste) throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
      await actualizarCuentaSupabase(id, { email });
    }

    const actualizado = await cajerosRepo.actualizar(id, { usuario: email, nombre: String(nombre).trim() });
    return aPublico(actualizado);
  }

  return editarSupervisor(id, { usuario, nombre });
}

/** TDSI-47/917: "Cambiar contrasena" -- solo existe para cajeros (login con Supabase Auth). */
async function cambiarPasswordCajero(cajero_id, { password } = {}) {
  if (!password || String(password).length < 6) {
    throw new AppError("La contrasena debe tener al menos 6 caracteres.", 400);
  }

  const cajero = await cajerosRepo.buscarPorCajeroId(cajero_id);
  if (!cajero) throw new AppError("Cajero no encontrado.", 404);

  await actualizarCuentaSupabase(cajero_id, { password });
  return aPublico(cajero);
}

module.exports = { crearCajero, listarUsuarios, editarUsuario, cambiarPasswordCajero };
