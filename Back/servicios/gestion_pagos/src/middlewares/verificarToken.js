const jwt = require("jsonwebtoken");
const cfg = require("../config/auth");
const repo = require("../data/sistemasClienteRepo");

function noAutorizado(res, mensaje) {
  res.set("WWW-Authenticate", 'Bearer realm="gestion_pagos"');
  return res.status(401).json({ ok: false, mensaje });
}

/** TDSI-338: rechaza solicitudes con token ausente, inválido o vencido */
async function verificarToken(req, res, next) {
  const [esquema, token] = (req.headers.authorization || "").split(" ");
  if (esquema !== "Bearer" || !token)
    return noAutorizado(res, "Token de acceso requerido");

  let payload;
  try {
    payload = jwt.verify(token, cfg.JWT_SECRET, {
      algorithms: [cfg.JWT_ALGORITMO],
      issuer: cfg.JWT_ISSUER,
      audience: cfg.JWT_AUDIENCE,
    });
  } catch (e) {
    if (e.name === "TokenExpiredError")
      return noAutorizado(res, "El token ha vencido");
    return noAutorizado(res, "Token inválido");
  }

  try {
    // Si el sistema fue deshabilitado después de recibir el token, se rechaza igual
    if (!(await repo.estaActivo(payload.sub)))
      return noAutorizado(res, "El Sistema Cliente ya no está autorizado");
  } catch (e) {
    return next(e);
  }

  req.sistemaCliente = { client_id: payload.sub, nombre: payload.nombre };
  next();
}

module.exports = { verificarToken };