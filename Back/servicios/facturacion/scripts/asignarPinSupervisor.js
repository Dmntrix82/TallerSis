require("dotenv").config();
const repo = require("../src/data/supervisoresRepo");
const { hashSecret } = require("../src/utils/secretHash");
const { PIN_REGEX } = require("../src/config/pin");

async function main() {
  const [supervisorId, pin, ...resto] = process.argv.slice(2);
  const nombre = resto.join(" ");
  if (!supervisorId || !pin || !nombre) {
    console.error('Uso: npm run asignar-pin -- <supervisor_id> <pin> "<nombre>"');
    process.exitCode = 1;
    return;
  }
  if (!PIN_REGEX.test(pin)) {
    console.error("El PIN debe tener entre 4 y 6 dígitos");
    process.exitCode = 1;
    return;
  }
  const sup = await repo.guardarPin({
    supervisor_id: supervisorId,
    nombre,
    pin_hash: hashSecret(pin),
  });
  console.log(`PIN asignado a ${sup.nombre} (${sup.supervisor_id})`);
}

main()
  .catch((e) => { console.error("Error:", e.message); process.exitCode = 1; })
  .finally(() => process.exit());