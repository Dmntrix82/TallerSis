const { Router } = require("express");
const { validarPin } = require("../services/pinService");
const {
  listarSupervisores, crearSupervisor, editarSupervisor, restablecerPin, cambiarEstadoSupervisor,
} = require("../services/supervisoresService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-187: lista para la pantalla "Supervisores" del Administrador (sin PIN)
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await listarSupervisores() });
}));

// TDSI-721: "Nuevo supervisor" (usuario, nombre y PIN inicial)
router.post("/", wrap(async (req, res) => {
  const supervisor = await crearSupervisor(req.body);
  res.status(201).json({ ok: true, data: supervisor });
}));

// TDSI-47/917: "Editar" (cambia nombre y usuario; el PIN no se toca aqui)
router.put("/:id", wrap(async (req, res) => {
  const supervisor = await editarSupervisor(req.params.id, req.body);
  res.json({ ok: true, data: supervisor });
}));

// TDSI-722: "Restablecer PIN" (PIN nuevo + limpia intentos fallidos y bloqueo)
router.put("/:id/pin", wrap(async (req, res) => {
  const supervisor = await restablecerPin(req.params.id, req.body);
  res.json({ ok: true, data: supervisor });
}));

// TDSI-723: "Activar" / "Desactivar" ({ activo: true | false })
router.patch("/:id/estado", wrap(async (req, res) => {
  const supervisor = await cambiarEstadoSupervisor(req.params.id, req.body);
  res.json({ ok: true, data: supervisor });
}));

// Validacion generica del codigo (usuario + PIN) de un supervisor de caja.
// La usa tanto la autorizacion de anulaciones (aca mismo) como la apertura de
// turno en gestion_caja (via HTTP, ver supervisorProxy.js), para no duplicar
// el registro de supervisores en dos schemas distintos.
router.post("/validar", wrap(async (req, res) => {
  const supervisor = await validarPin(req.body.supervisor_id, req.body.pin);
  res.json({ ok: true, data: supervisor });
}));

module.exports = router;
