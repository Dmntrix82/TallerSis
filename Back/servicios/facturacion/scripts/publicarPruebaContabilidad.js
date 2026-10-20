// TDSI-22: verifica la conexion con el topico de Contabilidad (Grupo D) SIN publicar nada:
// Contabilidad registra cada mensaje del topico como un documento contable, asi que una
// "prueba" se contabilizaria. Para probar de punta a punta se emite una factura real.
// Uso: npm run pubsub:prueba   (lee CONTABILIDAD_PUBSUB_TOPIC y la credencial del .env)
require("dotenv").config();
const cfg = require("../src/config/contabilidad");
const { verificarPermiso } = require("../src/clients/pubsubPublisher");

(async () => {
  if (!cfg.PUBSUB_TOPIC) {
    console.error("Falta CONTABILIDAD_PUBSUB_TOPIC en el .env");
    process.exit(1);
  }
  if (cfg.GOOGLE_CREDENTIALS) console.log(`Credencial: GOOGLE_CREDENTIALS_JSON (${cfg.GOOGLE_CREDENTIALS.client_email})`);
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) console.log(`Credencial: archivo ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  else {
    console.error("Falta GOOGLE_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS en el .env");
    process.exit(1);
  }

  console.log(`Topico: ${cfg.PUBSUB_TOPIC}`);
  const permiso = await verificarPermiso();
  if (!permiso.ok) {
    console.error("Permiso para publicar: NO ->", permiso.error);
    process.exit(1);
  }
  console.log("Permiso para publicar: OK (no se publico ningun mensaje)");
})();
