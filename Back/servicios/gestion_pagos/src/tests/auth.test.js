const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const cfg = require("../config/auth");
const { hashSecret, verificarSecret } = require("../utils/secretHash");
const { generarToken, validarCredenciales } = require("../services/authService");

// ---------------------------------------------------------------------------
// Helpers para preparar y limpiar la BD
// ---------------------------------------------------------------------------

const CLIENT_ID_VALIDO = "TEST-TDSI11-OK";
const CLIENT_ID_INACTIVO = "TEST-TDSI11-INACTIVO";
const SECRET_VALIDO = "secreto-super-largo-y-random-para-tests-123456";

async function limpiar() {
  await query(
    `DELETE FROM pagos.sistemas_cliente WHERE client_id IN ($1, $2)`,
    [CLIENT_ID_VALIDO, CLIENT_ID_INACTIVO]
  );
}

async function crearSistemaDePrueba({ clientId, activo = true, secret = SECRET_VALIDO }) {
  await query(
    `INSERT INTO pagos.sistemas_cliente (client_id, nombre, secret_hash, activo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id) DO UPDATE
       SET secret_hash = EXCLUDED.secret_hash,
           activo = EXCLUDED.activo`,
    [clientId, `Sistema ${clientId}`, hashSecret(secret), activo]
  );
}

test.before(async () => {
  await limpiar();
  await crearSistemaDePrueba({ clientId: CLIENT_ID_VALIDO, activo: true });
  await crearSistemaDePrueba({ clientId: CLIENT_ID_INACTIVO, activo: false });
});

test.after(async () => {
  await limpiar();
});

// ---------------------------------------------------------------------------
// TDSI-103: hash del secret
// ---------------------------------------------------------------------------

test("TDSI-103: hashSecret produce formato salt:hash y hashes distintos con el mismo secret", () => {
  const h1 = hashSecret("mismo-secret");
  const h2 = hashSecret("mismo-secret");
  assert.match(h1, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.notEqual(h1, h2, "El salt debe ser distinto en cada llamada");
});

test("TDSI-103: verificarSecret acepta el secret correcto", () => {
  const almacenado = hashSecret(SECRET_VALIDO);
  assert.equal(verificarSecret(SECRET_VALIDO, almacenado), true);
});

test("TDSI-103: verificarSecret rechaza un secret incorrecto", () => {
  const almacenado = hashSecret(SECRET_VALIDO);
  assert.equal(verificarSecret("otro-secret", almacenado), false);
});

test("TDSI-103: verificarSecret rechaza un valor malformado", () => {
  assert.equal(verificarSecret("x", "sin-salt-ni-hash"), false);
  assert.equal(verificarSecret("x", ""), false);
});

// ---------------------------------------------------------------------------
// TDSI-336: validar credenciales
// ---------------------------------------------------------------------------

test("TDSI-336: validarCredenciales retorna el sistema si el secret es correcto", async () => {
  const s = await validarCredenciales({
    client_id: CLIENT_ID_VALIDO,
    client_secret: SECRET_VALIDO,
  });
  assert.equal(s.client_id, CLIENT_ID_VALIDO);
});

test("TDSI-336: validarCredenciales lanza 401 si el client_id no existe", async () => {
  await assert.rejects(
    () => validarCredenciales({ client_id: "no-existe", client_secret: "x" }),
    (e) => e.status === 401
  );
});

test("TDSI-336: validarCredenciales lanza 401 si el secret es incorrecto", async () => {
  await assert.rejects(
    () => validarCredenciales({ client_id: CLIENT_ID_VALIDO, client_secret: "malo" }),
    (e) => e.status === 401
  );
});

test("TDSI-336: validarCredenciales lanza 403 si el sistema esta inactivo", async () => {
  await assert.rejects(
    () => validarCredenciales({ client_id: CLIENT_ID_INACTIVO, client_secret: SECRET_VALIDO }),
    (e) => e.status === 403
  );
});

test("TDSI-336: validarCredenciales lanza 400 si faltan campos", async () => {
  await assert.rejects(() => validarCredenciales({}), (e) => e.status === 400);
  await assert.rejects(
    () => validarCredenciales({ client_id: CLIENT_ID_VALIDO }),
    (e) => e.status === 400
  );
});

// ---------------------------------------------------------------------------
// TDSI-335 + TDSI-337: generar token
// ---------------------------------------------------------------------------

test("TDSI-335: generarToken devuelve un JWT firmado con expiracion configurable", async () => {
  const r = await generarToken({
    client_id: CLIENT_ID_VALIDO,
    client_secret: SECRET_VALIDO,
  });

  assert.equal(r.token_type, "Bearer");
  assert.equal(r.expires_in, cfg.JWT_EXPIRES_IN_SEG);
  assert.ok(r.access_token, "Debe devolver access_token");
  assert.ok(r.expira_en, "Debe devolver expira_en");

  const payload = jwt.verify(r.access_token, cfg.JWT_SECRET, {
    algorithms: [cfg.JWT_ALGORITMO],
    issuer: cfg.JWT_ISSUER,
    audience: cfg.JWT_AUDIENCE,
  });
  assert.equal(payload.sub, CLIENT_ID_VALIDO);
  assert.equal(payload.iss, cfg.JWT_ISSUER);
  assert.equal(payload.aud, cfg.JWT_AUDIENCE);
  assert.equal(payload.tipo, "sistema_cliente");
  assert.ok(payload.exp > payload.iat, "exp debe ser posterior a iat");
});

test("TDSI-335: generarToken rechaza credenciales invalidas", async () => {
  await assert.rejects(
    () => generarToken({ client_id: CLIENT_ID_VALIDO, client_secret: "malo" }),
    (e) => e.status === 401
  );
});

// ---------------------------------------------------------------------------
// TDSI-338: middleware verificarToken
// ---------------------------------------------------------------------------

function invocarMiddleware(headers) {
  return new Promise((resolve) => {
    const req = { headers };
    const res = {
      status: null,
      body: null,
      set: () => {},
      status(codigo) {
        this.status = codigo;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ status: this.status, body: this.body, req });
        return this;
      },
    };
    const next = (err) => {
      resolve({ status: null, body: null, req, error: err || null });
    };
    const { verificarToken } = require("../middlewares/verificarToken");
    verificarToken(req, res, next);
  });
}

test("TDSI-338: verificarToken rechaza peticion sin header Authorization", async () => {
  const r = await invocarMiddleware({});
  assert.equal(r.status, 401);
  assert.match(r.body.mensaje, /Token de acceso requerido/);
});

test("TDSI-338: verificarToken rechaza esquema que no es Bearer", async () => {
  const r = await invocarMiddleware({ authorization: "Basic abc123" });
  assert.equal(r.status, 401);
});

test("TDSI-338: verificarToken rechaza un token mal formado", async () => {
  const r = await invocarMiddleware({ authorization: "Bearer no-es-un-jwt" });
  assert.equal(r.status, 401);
  assert.match(r.body.mensaje, /inválido|vencido/i);
});

test("TDSI-338: verificarToken acepta un token valido y agrega req.sistemaCliente", async () => {
  const { access_token } = await generarToken({
    client_id: CLIENT_ID_VALIDO,
    client_secret: SECRET_VALIDO,
  });
  const r = await invocarMiddleware({ authorization: `Bearer ${access_token}` });
  assert.equal(r.status, null, "No debe responder error");
  assert.ok(r.req.sistemaCliente, "Debe setear req.sistemaCliente");
  assert.equal(r.req.sistemaCliente.client_id, CLIENT_ID_VALIDO);
});

test("TDSI-337/338: verificarToken rechaza un token vencido", async () => {
  const tokenVencido = jwt.sign(
    { nombre: "Sistema vencido", tipo: "sistema_cliente" },
    cfg.JWT_SECRET,
    {
      subject: CLIENT_ID_VALIDO,
      expiresIn: -10,
      issuer: cfg.JWT_ISSUER,
      audience: cfg.JWT_AUDIENCE,
      algorithm: cfg.JWT_ALGORITMO,
    }
  );
  const r = await invocarMiddleware({ authorization: `Bearer ${tokenVencido}` });
  assert.equal(r.status, 401);
  assert.match(r.body.mensaje, /vencido/i);
});

test("TDSI-338: verificarToken rechaza si el sistema fue deshabilitado despues de emitir el token", async () => {
  const { access_token } = await generarToken({
    client_id: CLIENT_ID_VALIDO,
    client_secret: SECRET_VALIDO,
  });

  await query(
    `UPDATE pagos.sistemas_cliente SET activo = false WHERE client_id = $1`,
    [CLIENT_ID_VALIDO]
  );

  const r = await invocarMiddleware({ authorization: `Bearer ${access_token}` });
  assert.equal(r.status, 401);
  assert.match(r.body.mensaje, /no está autorizado/i);

  await query(
    `UPDATE pagos.sistemas_cliente SET activo = true WHERE client_id = $1`,
    [CLIENT_ID_VALIDO]
  );
});