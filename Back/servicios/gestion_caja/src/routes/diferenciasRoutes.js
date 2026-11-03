const { Router } = require("express");
const { resolverDiferencia, listarDiferencias, reenviarContabilidad } = require("../services/diferenciasService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-52/701: "Diferencias de caja" del Administrador, con el estado del aviso a
// Contabilidad (columna "Contabilidad" del Front). ?estado=PENDIENTE|RESUELTA opcional.
router.get("/diferencias", wrap(async (req, res) => {
  const data = await listarDiferencias({ estado: req.query.estado });
  res.json({ ok: true, data });
}));

// TDSI-52/698: el Administrador resuelve una diferencia con su justificacion; el
// sistema publica el aviso a Contabilidad (DIF-<id>) y devuelve si se pudo enviar.
router.post("/diferencias/:id/resolver", wrap(async (req, res) => {
  const data = await resolverDiferencia(req.params.id, req.body);
  res.json({ ok: true, mensaje: "Diferencia resuelta", data });
}));

// TDSI-52/701: boton "Reenviar" -- solo si el aviso anterior no se pudo publicar o
// Contabilidad lo rechazo.
router.post("/diferencias/:id/reenviar-contabilidad", wrap(async (req, res) => {
  const data = await reenviarContabilidad(req.params.id);
  res.json({ ok: true, mensaje: "Reenviado a Contabilidad", data });
}));

module.exports = router;
