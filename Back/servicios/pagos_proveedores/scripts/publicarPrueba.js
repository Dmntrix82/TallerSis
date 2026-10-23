// TDSI-656: verifica la conexion con el topico real y publica un mensaje de prueba.
// Uso: npm run pubsub:prueba   (lee PUBSUB_TOPIC y la credencial del .env)
// Si imprime un messageId, Google ya guardo el mensaje en el topico y lo entrega
// a la suscripcion del ingeniero ("Extraer mensajes" en la consola).
require("dotenv").config();
const cfg = require("../src/config/integraciones");
const { publicarReporte, verificarPermiso } = require("../src/clients/pubsubPublisher");

(async () => {
  if (!cfg.PUBSUB_TOPIC) {
    console.error("Falta PUBSUB_TOPIC en el .env");
    process.exit(1);
  }
  if (cfg.GOOGLE_CREDENTIALS) {
    console.log(`Credencial: GOOGLE_CREDENTIALS_JSON (${cfg.GOOGLE_CREDENTIALS.client_email})`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(`Credencial: archivo ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  } else {
    console.error("Falta GOOGLE_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS en el .env");
    process.exit(1);
  }

  console.log(`Topico: ${cfg.PUBSUB_TOPIC}`);
  const permiso = await verificarPermiso();
  if (!permiso.ok) {
    console.error("1/2 Permiso para publicar: NO ->", permiso.error);
    process.exit(1);
  }
  console.log("1/2 Permiso para publicar: OK");

  const r = await publicarReporte(
    { tipo: "PRUEBA_CONEXION", origen: "pagos_proveedores", grupo: "A", enviado_en: new Date().toISOString() },
    { tipo: "PRUEBA_CONEXION", origen: "pagos_proveedores", grupo: "A" }
  );
  if (!r.ok) {
    console.error("2/2 Publicacion: NO ->", r.error);
    process.exit(1);
  }
  console.log(`2/2 Publicacion: OK, messageId ${r.messageId}`);
})();
