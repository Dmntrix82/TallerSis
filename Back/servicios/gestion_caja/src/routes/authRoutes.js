const { Router } = require("express");
const { autenticarCajero } = require("../services/authService");
const { validarCajaDisponible } = require("../services/cajaService");
const { registrarInicioSesion, cerrarSesionesInactivas } = require("../services/sesionCajeroService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/login", wrap(async (req, res) => {
  const cajero = await autenticarCajero(req.body);
  const caja = await validarCajaDisponible(req.body.caja_id);
  const sesion = await registrarInicioSesion({
    cajero_id: cajero.cajero_id,
    cajero_nombre: cajero.email,
    caja_id: caja.codigo,
  });
  res.json({ ok: true, mensaje: "Login exitoso, terminal habilitado", data: { cajero, caja, sesion } });
}));

// Fuerza el cierre de sesiones inactivas ahora mismo (util para pruebas manuales)
router.post("/cerrar-inactivas", wrap(async (req, res) => {
  const cerradas = await cerrarSesionesInactivas();
  res.json({ ok: true, mensaje: `${cerradas.length} sesion(es) cerrada(s) por inactividad.`, data: cerradas });
}));

module.exports = router;
