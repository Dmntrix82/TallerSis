const { AppError } = require("../utils/AppError");

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, mensaje: err.message, detalle: err.detalle });
  }
  console.error(err);
  return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
}
module.exports = { errorHandler };