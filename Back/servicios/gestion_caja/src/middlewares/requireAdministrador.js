const administradoresRepo = require("../data/administradoresRepo");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function noAutorizado(res, mensaje) {
  return res.status(401).json({ ok: false, mensaje });
}

/**
 * TDSI-47/919: "Solo el Administrador gestiona las cuentas". Valida el access_token
 * de Supabase Auth del que llama (el mismo que devuelve /api/auth/login-administrador)
 * y que exista como administrador activo en caja.administradores -- mismo chequeo
 * que ya hace administradorAuthService.autenticarAdministrador al iniciar sesion.
 */
async function requireAdministrador(req, res, next) {
  const [esquema, token] = (req.headers.authorization || "").split(" ");
  if (esquema !== "Bearer" || !token) {
    return noAutorizado(res, "Token de acceso requerido");
  }

  let usuario;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return noAutorizado(res, "Token invalido o vencido");
    usuario = await r.json();
  } catch (e) {
    return next(e);
  }

  try {
    const administrador = await administradoresRepo.buscarPorCajeroId(usuario.id);
    if (!administrador || !administrador.activo) {
      return res.status(403).json({ ok: false, mensaje: "Esta accion requiere permisos de Administrador." });
    }
    req.administrador = { administrador_id: usuario.id, nombre: administrador.nombre };
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { requireAdministrador };
