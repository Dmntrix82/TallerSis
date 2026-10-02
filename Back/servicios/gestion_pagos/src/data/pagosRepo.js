const { query, withTransaction } = require("../config/db");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// ---------- Pago simple / historial (TDSI-85/262/271/272) ----------

/**
 * El ID de transaccion ya no lo escribe el cajero: se genera aqui mismo con el
 * correlativo de la propia tabla (nextval de su secuencia), asi queda unico
 * por construccion, sin depender de que el cajero no repita un numero.
 */
async function insertarTransaccionSimple({ metodo, monto, nit, razon_social, tipo_documento, telefono, caja_id, turno_id, cajero }) {
  const { rows } = await query(
    `WITH nuevo AS (
       SELECT nextval(pg_get_serial_sequence('pagos.transacciones', 'id')) AS id
     )
     INSERT INTO pagos.transacciones
       (id, id_transaccion, metodo, monto, tipo_pago, nit, razon_social, tipo_documento, telefono, caja_id, turno_id, cajero)
     SELECT id, 'VTA-' || lpad(id::text, 6, '0'), $1, $2, 'Simple', $3, $4, $5, $6, $7, $8, $9
     FROM nuevo
     RETURNING *`,
    [metodo, monto, nit || null, razon_social || null, tipo_documento || null, telefono || null, caja_id || null, turno_id || null, cajero || null]
  );
  return { ...rows[0], monto: num(rows[0].monto) };
}

/** Todas las filas de una misma venta (una sola si es pago Simple, varias si es Mixto). */
async function buscarTransaccionesPorIdTransaccion(id_transaccion) {
  const { rows } = await query(
    `SELECT * FROM pagos.transacciones WHERE id_transaccion = $1 AND estado = 'Registrado' ORDER BY fecha, id`,
    [id_transaccion]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

/**
 * Igual que buscarTransaccionesPorIdTransaccion pero SIN filtrar por estado: una
 * factura ya anulada debe poder seguir viendose/imprimiendose (marcada como
 * anulada), no desaparecer como si nunca hubiera existido.
 */
async function buscarTodasTransaccionesPorIdTransaccion(id_transaccion) {
  const { rows } = await query(
    `SELECT * FROM pagos.transacciones WHERE id_transaccion = $1 ORDER BY fecha, id`,
    [id_transaccion]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

/** Autocompletado de razon social: busca el ultimo pago (simple o mixto) que uso ese mismo documento. */
async function buscarRazonSocialPorDocumento(tipo_documento, numero) {
  const { rows } = await query(
    `SELECT razon_social FROM pagos.transacciones
      WHERE tipo_documento = $1 AND nit = $2 AND razon_social IS NOT NULL
      ORDER BY fecha DESC LIMIT 1`,
    [tipo_documento, numero]
  );
  return rows[0]?.razon_social || null;
}

/**
 * TDSI-306: lista "una fila por venta" (agrupa por id_transaccion, asi un pago
 * mixto con 2 metodos aparece una sola vez) de las ventas de un cajero.
 * TDSI-307: desde/hasta (objetos Date) filtran por rango de fecha de emision.
 */
async function listarPorCajero(cajero, { desde, hasta } = {}) {
  const condiciones = ["cajero = $1"];
  const params = [cajero];
  if (desde) {
    params.push(desde);
    condiciones.push(`fecha >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    condiciones.push(`fecha <= $${params.length}`);
  }

  const { rows } = await query(
    `SELECT id_transaccion,
            MIN(fecha) AS fecha,
            SUM(monto) AS total,
            MAX(tipo_pago) AS tipo_pago,
            array_agg(metodo ORDER BY id) AS metodos,
            MAX(nit) AS nit,
            MAX(razon_social) AS razon_social,
            MAX(tipo_documento) AS tipo_documento,
            MAX(caja_id) AS caja_id,
            bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE ${condiciones.join(" AND ")}
      GROUP BY id_transaccion
      ORDER BY MIN(fecha) DESC`,
    params
  );
  return rows.map((r) => ({
    id_transaccion: r.id_transaccion,
    fecha: r.fecha,
    total: num(r.total),
    tipo_pago: r.tipo_pago,
    metodos: r.metodos,
    nit: r.nit,
    razon_social: r.razon_social,
    tipo_documento: r.tipo_documento,
    caja_id: r.caja_id,
    estado: r.anulado ? 'Anulado' : 'Registrado',
  }));
}

/** Anula TODAS las filas de una venta (una si es Simple, varias si es Mixto) en una transaccion SQL. */
async function anularTransaccion(id_transaccion, { anulado_por }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE pagos.transacciones
          SET estado = 'Anulado', anulado_por = $2, anulado_en = now()
        WHERE id_transaccion = $1 AND estado = 'Registrado'
        RETURNING *`,
      [id_transaccion, anulado_por || null]
    );
    if (rows.length === 0) return [];

    await client.query(
      `UPDATE pagos.pagos_mixtos SET estado = 'Anulado' WHERE id_transaccion = $1`,
      [id_transaccion]
    );

    return rows.map((r) => ({ ...r, monto: num(r.monto) }));
  });
}

/**
 * TDSI-323: reporte de ventas de una caja en un rango de tiempo (el turno actual),
 * para el cierre de caja: cuanto se gano por metodo, cuantas ventas, cuantas anuladas.
 */
async function reporteTurno(caja_id, desde, hasta) {
  const { rows: porMetodo } = await query(
    `SELECT metodo, SUM(monto) AS total, COUNT(*)::int AS operaciones
       FROM pagos.transacciones
      WHERE caja_id = $1 AND estado = 'Registrado' AND fecha >= $2 AND fecha <= $3
      GROUP BY metodo`,
    [caja_id, desde, hasta]
  );

  const { rows: ventas } = await query(
    `SELECT id_transaccion, SUM(monto) AS total, bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE caja_id = $1 AND fecha >= $2 AND fecha <= $3
      GROUP BY id_transaccion`,
    [caja_id, desde, hasta]
  );

  const totales = { Efectivo: 0, Tarjeta: 0, QR: 0 };
  const operacionesPorMetodo = { Efectivo: 0, Tarjeta: 0, QR: 0 };
  for (const fila of porMetodo) {
    totales[fila.metodo] = num(fila.total);
    operacionesPorMetodo[fila.metodo] = fila.operaciones;
  }

  let cantidadVentas = 0;
  let cantidadAnuladas = 0;
  let montoAnulado = 0;
  for (const v of ventas) {
    if (v.anulado) {
      cantidadAnuladas += 1;
      montoAnulado += num(v.total);
    } else {
      cantidadVentas += 1;
    }
  }

  return {
    totalEfectivo: totales.Efectivo,
    totalTarjeta: totales.Tarjeta,
    totalQR: totales.QR,
    totalDigital: totales.Tarjeta + totales.QR,
    totalGeneral: totales.Efectivo + totales.Tarjeta + totales.QR,
    operacionesPorMetodo,
    cantidadVentas,
    cantidadAnuladas,
    montoAnulado,
  };
}

/**
 * TDSI-329: lista de cajeros que registraron al menos una venta, con sus
 * totales, para la pantalla "Cajeros" del administrador. No existe un registro
 * de cuentas de cajero como tal (las cuentas viven en Supabase Auth); esta es
 * la fuente mas confiable de "quienes han trabajado" en el sistema.
 */
async function listarCajeros() {
  const { rows } = await query(
    `SELECT cajero,
            COUNT(DISTINCT id_transaccion) FILTER (WHERE estado = 'Registrado') AS cantidad_ventas,
            COALESCE(SUM(monto) FILTER (WHERE estado = 'Registrado'), 0) AS total_facturado,
            MIN(fecha) AS primera_venta,
            MAX(fecha) AS ultima_venta
       FROM pagos.transacciones
      WHERE cajero IS NOT NULL
      GROUP BY cajero
      ORDER BY cajero`
  );
  return rows.map((r) => ({
    cajero: r.cajero,
    cantidadVentas: Number(r.cantidad_ventas),
    totalFacturado: num(r.total_facturado),
    primeraVenta: r.primera_venta,
    ultimaVenta: r.ultima_venta,
  }));
}

/**
 * TDSI-330: rankings para el tablero del administrador -- que caja, que cajero
 * y que cliente generan mas (todo el historico, no solo un dia).
 */
async function rankingCajas() {
  const { rows } = await query(
    `SELECT caja_id, SUM(monto) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
       FROM pagos.transacciones
      WHERE estado = 'Registrado' AND caja_id IS NOT NULL
      GROUP BY caja_id
      ORDER BY total DESC`
  );
  return rows.map((r) => ({ caja_id: r.caja_id, total: num(r.total), cantidadVentas: r.cantidad }));
}

// TDSI-330: sin limite por defecto -- se pide "todos los cajeros que hay",
// no solo un top acotado (no existe un registro de cuentas aparte de ventas).
async function rankingCajeros(limite = null) {
  const { rows } = await query(
    `SELECT cajero, SUM(monto) AS total, COUNT(DISTINCT id_transaccion)::int AS cantidad
       FROM pagos.transacciones
      WHERE estado = 'Registrado' AND cajero IS NOT NULL
      GROUP BY cajero
      ORDER BY total DESC
      ${limite ? "LIMIT $1" : ""}`,
    limite ? [limite] : []
  );
  return rows.map((r) => ({ cajero: r.cajero, total: num(r.total), cantidadVentas: r.cantidad }));
}

async function rankingClientes(limite = 5) {
  const { rows } = await query(
    `SELECT tipo_documento, nit AS numero, MAX(razon_social) AS razon_social,
            COUNT(DISTINCT id_transaccion)::int AS cantidad, SUM(monto) AS total
       FROM pagos.transacciones
      WHERE estado = 'Registrado' AND nit IS NOT NULL
      GROUP BY tipo_documento, nit
      ORDER BY cantidad DESC, total DESC
      LIMIT $1`,
    [limite]
  );
  return rows.map((r) => ({
    tipo_documento: r.tipo_documento,
    numero: r.numero,
    razon_social: r.razon_social,
    cantidadCompras: r.cantidad,
    totalGastado: num(r.total),
  }));
}

/**
 * TDSI-327: historial de compras de un cliente (NIT o CI), para que el
 * administrador vea cuantas veces vino y que factura cada vez.
 */
async function historialPorDocumento(tipo_documento, numero) {
  const { rows } = await query(
    `SELECT id_transaccion,
            MIN(fecha) AS fecha,
            SUM(monto) AS total,
            array_agg(metodo ORDER BY id) AS metodos,
            MAX(razon_social) AS razon_social,
            MAX(caja_id) AS caja_id,
            MAX(cajero) AS cajero,
            bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE tipo_documento = $1 AND nit = $2
      GROUP BY id_transaccion
      ORDER BY MIN(fecha) DESC`,
    [tipo_documento, numero]
  );
  return rows.map((r) => ({
    id_transaccion: r.id_transaccion,
    fecha: r.fecha,
    total: num(r.total),
    metodos: r.metodos,
    razon_social: r.razon_social,
    caja_id: r.caja_id,
    cajero: r.cajero,
    estado: r.anulado ? 'Anulado' : 'Registrado',
  }));
}

/**
 * TDSI-328: totales de todas las ventas del sistema (todas las cajas), para el
 * tablero del administrador -- cuanto se ha ganado en total desde el inicio.
 */
async function totalesGenerales(desde, hasta) {
  const { rows: porMetodo } = await query(
    `SELECT metodo, SUM(monto) AS total, COUNT(*)::int AS operaciones
       FROM pagos.transacciones
      WHERE estado = 'Registrado' AND fecha >= $1 AND fecha <= $2
      GROUP BY metodo`,
    [desde, hasta]
  );

  const { rows: ventas } = await query(
    `SELECT id_transaccion, SUM(monto) AS total, bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE fecha >= $1 AND fecha <= $2
      GROUP BY id_transaccion`,
    [desde, hasta]
  );

  const totales = { Efectivo: 0, Tarjeta: 0, QR: 0 };
  const operacionesPorMetodo = { Efectivo: 0, Tarjeta: 0, QR: 0 };
  for (const fila of porMetodo) {
    totales[fila.metodo] = num(fila.total);
    operacionesPorMetodo[fila.metodo] = fila.operaciones;
  }

  let cantidadVentas = 0;
  let cantidadAnuladas = 0;
  let montoAnulado = 0;
  for (const v of ventas) {
    if (v.anulado) {
      cantidadAnuladas += 1;
      montoAnulado += num(v.total);
    } else {
      cantidadVentas += 1;
    }
  }

  return {
    totalEfectivo: totales.Efectivo,
    totalTarjeta: totales.Tarjeta,
    totalQR: totales.QR,
    totalDigital: totales.Tarjeta + totales.QR,
    totalGeneral: totales.Efectivo + totales.Tarjeta + totales.QR,
    operacionesPorMetodo,
    cantidadVentas,
    cantidadAnuladas,
    montoAnulado,
  };
}

async function contarTransacciones() {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM pagos.transacciones`);
  return rows[0].total;
}

async function listarHistorial() {
  const { rows } = await query(`SELECT * FROM pagos.transacciones ORDER BY fecha DESC`);
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

// ---------- Pago mixto (TDSI-87/275/276/277) ----------

async function existePagoMixto(id_transaccion) {
  const { rows } = await query(
    `SELECT 1 FROM pagos.pagos_mixtos WHERE id_transaccion = $1`,
    [id_transaccion]
  );
  return rows.length > 0;
}

/**
 * Inserta cabecera + detalle + transacciones del pago mixto en una sola transaccion SQL.
 * Si no se pasa id_transaccion (caso normal desde la pantalla de Pagos), se genera aqui
 * con el mismo correlativo VTA-000NNN que usa el pago simple, asi queda unico por construccion.
 */
async function registrarPagoMixtoCompleto({ id_transaccion, cajaId, turnoId, total, metodos, nit, razon_social, tipo_documento, telefono, cajero }) {
  return withTransaction(async (client) => {
    let idTransaccion = id_transaccion;
    if (!idTransaccion) {
      const { rows: idRows } = await client.query(
        `SELECT nextval(pg_get_serial_sequence('pagos.transacciones', 'id')) AS id`
      );
      idTransaccion = 'VTA-' + String(idRows[0].id).padStart(6, '0');
    }

    const { rows: pagoRows } = await client.query(
      `INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, turno_id, total)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [idTransaccion, cajaId || null, turnoId || null, total]
    );
    const pago = pagoRows[0];

    const detalle = [];
    for (const m of metodos) {
      const { rows } = await client.query(
        `INSERT INTO pagos.detalles_pago (pago_id, metodo, monto, porcentaje, referencia, orden)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [pago.id, m.metodo, m.monto, m.porcentaje, m.referencia || null, m.orden]
      );
      detalle.push(rows[0]);
    }

    const transacciones = [];
    for (const d of detalle) {
      const { rows } = await client.query(
        `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id, nit, razon_social, tipo_documento, telefono, cajero, caja_id)
         VALUES ($1, $2, $3, 'Mixto', $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [pago.id_transaccion, d.metodo, d.monto, pago.id, nit || null, razon_social || null, tipo_documento || null, telefono || null, cajero || null, cajaId || null]
      );
      transacciones.push(rows[0]);
    }

    return {
      pago: { ...pago, total: num(pago.total) },
      detalle: detalle.map((d) => ({ ...d, monto: num(d.monto), porcentaje: num(d.porcentaje) })),
      transacciones: transacciones.map((t) => ({ ...t, monto: num(t.monto) })),
    };
  });
}

async function obtenerPagoMixtoPorTransaccion(id_transaccion) {
  const { rows: pagoRows } = await query(
    `SELECT * FROM pagos.pagos_mixtos WHERE id_transaccion = $1`,
    [id_transaccion]
  );
  const pago = pagoRows[0];
  if (!pago) return null;

  const { rows: detalle } = await query(
    `SELECT * FROM pagos.detalles_pago WHERE pago_id = $1 ORDER BY orden`,
    [pago.id]
  );

  return {
    ...pago,
    total: num(pago.total),
    detalle: detalle.map((d) => ({ ...d, monto: num(d.monto), porcentaje: num(d.porcentaje) })),
  };
}

module.exports = {
  insertarTransaccionSimple,
  buscarTransaccionesPorIdTransaccion,
  buscarTodasTransaccionesPorIdTransaccion,
  buscarRazonSocialPorDocumento,
  listarPorCajero,
  anularTransaccion,
  reporteTurno,
  listarCajeros,
  rankingCajas,
  rankingCajeros,
  rankingClientes,
  historialPorDocumento,
  totalesGenerales,
  contarTransacciones,
  listarHistorial,
  existePagoMixto,
  registrarPagoMixtoCompleto,
  obtenerPagoMixtoPorTransaccion,
};