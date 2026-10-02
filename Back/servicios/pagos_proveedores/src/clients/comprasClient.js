const cfg = require("../config/compras");

async function enviarConfirmacion(payload, idempotencyKey) {
  const headers = { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey };
  if (cfg.COMPRAS_API_TOKEN) headers.Authorization = `Bearer ${cfg.COMPRAS_API_TOKEN}`;

  try {
    const res = await fetch(`${cfg.COMPRAS_API_URL}/confirmaciones-pago`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(cfg.TIMEOUT_MS),
    });

    if (res.ok) return { ok: true, status: res.status };

    const texto = (await res.text().catch(() => "")).slice(0, 300);
    const reintentable = res.status >= 500 || res.status === 408 || res.status === 429;
    return { ok: false, status: res.status, reintentable, error: `HTTP ${res.status}: ${texto}` };
  } catch (e) {
    const error = e.name === "TimeoutError"
      ? `Compras no respondió en ${cfg.TIMEOUT_MS} ms`
      : `Error de red: ${e.message}`;
    return { ok: false, status: null, reintentable: true, error };
  }
}

module.exports = { enviarConfirmacion };