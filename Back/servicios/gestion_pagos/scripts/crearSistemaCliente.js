require("dotenv").config();
const crypto = require("crypto");
const repo = require("../src/data/sistemasClienteRepo");
const { hashSecret } = require("../src/utils/secretHash");

async function main() {
  const [clientId, ...resto] = process.argv.slice(2);
  const nombre = resto.join(" ");
  if (!clientId || !nombre) {
    console.error('Uso: npm run crear-cliente -- <client_id> "<nombre>"');
    process.exitCode = 1;
    return;
  }

  const secret = crypto.randomBytes(32).toString("hex");
  const sistema = await repo.crear({
    client_id: clientId,
    nombre,
    secret_hash: hashSecret(secret),
  });

  console.log("Sistema Cliente creado:");
  console.log("  client_id:     ", sistema.client_id);
  console.log("  client_secret: ", secret);
  console.log("Guarda el client_secret ahora: no se puede recuperar después.");
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());