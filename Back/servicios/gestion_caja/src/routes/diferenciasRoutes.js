const { Router } = require("express");
const { resolverDiferencia } = require("../services/diferenciasService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-52/698: el Administrador resuelve una diferencia con su justificacion; el
// sistema publica el aviso a Contabilidad (DIF-<id>) y devuelve si se pudo enviar.
router.post("/diferencias/:id/resolver", wrap(async (req, res) => {
  const data = await resolverDiferencia(req.params.id, req.body);
  res.json({ ok: true, mensaje: "Diferencia resuelta", data });
}));

module.exports = router;
