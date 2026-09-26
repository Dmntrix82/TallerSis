const { Router } = require("express");
const { recibirVenta } = require("../services/ventaOnlineService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.post("/online", wrap(async (req, res) => {
  const data = await recibirVenta(req.body);
  res.status(201).json({ ok: true, data });
}));

module.exports = router;