const { Router } = require("express");
const { autenticarCajero } = require("../services/authService");
const { validarCajaDisponible } = require("../services/cajaService");
const { registrarInicioSesion, cerrarSesionesInactivas } = require("../services/sesionCajeroService");
const { verificarCajaLibreParaCajero } = require("../services/turnosService");
const { autenticarAdministrador } = require("../services/administradorAuthService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/login", wrap(async (req, res) => {
  const cajero = await autenticarCajero(req.body);
  const caja = await validarCajaDisponible(req.body.caja_id);
  // Una caja = un cajero a la vez: si ya hay un turno abierto, solo esa cuenta puede entrar.
  await verificarCajaLibreParaCajero(caja.codigo, cajero.email);
  const sesion = await registrarInicioSesion({
    cajero_id: cajero.cajero_id,
    cajero_nombre: cajero.email,
    caja_id: caja.codigo,
  });
  res.json({ ok: true, mensaje: "Login exitoso, terminal habilitado", data: { cajero, caja, sesion } });
}));

// Login de Administrador: mismo Supabase Auth que el cajero, sin caja_id ni sesion de terminal.
router.post("/login-administrador", wrap(async (req, res) => {
  const administrador = await autenticarAdministrador(req.body);
  res.json({ ok: true, mensaje: "Login exitoso", data: { administrador } });
}));

// Fuerza el cierre de sesiones inactivas ahora mismo (util para pruebas manuales)
router.post("/cerrar-inactivas", wrap(async (req, res) => {
  const cerradas = await cerrarSesionesInactivas();
  res.json({ ok: true, mensaje: `${cerradas.length} sesion(es) cerrada(s) por inactividad.`, data: cerradas });
}));

module.exports = router;
