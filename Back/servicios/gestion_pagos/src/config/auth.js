const MIN_SEG = 60;       // 1 minuto
const MAX_SEG = 86400;    // 24 horas
const DEFECTO_SEG = 900;  // 15 minutos

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET no está definido en .env o tiene menos de 32 caracteres");
}

const JWT_EXPIRES_IN_SEG = Number(process.env.JWT_EXPIRES_IN_SEG ?? DEFECTO_SEG);
if (
  !Number.isInteger(JWT_EXPIRES_IN_SEG) ||
  JWT_EXPIRES_IN_SEG < MIN_SEG ||
  JWT_EXPIRES_IN_SEG > MAX_SEG
) {
  throw new Error(
    `JWT_EXPIRES_IN_SEG debe ser un entero entre ${MIN_SEG} y ${MAX_SEG} segundos`
  );
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN_SEG,
  JWT_ISSUER: "gestion_pagos",
  JWT_AUDIENCE: "sistema_cliente",
  JWT_ALGORITMO: "HS256",
};