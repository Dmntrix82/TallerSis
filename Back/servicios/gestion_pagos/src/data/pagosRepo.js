const { query, withTransaction } = require("../config/db");
const { AppError } = require("../utils/AppError");

const num = (v) => (v === null || v === undefined ? v : Number(v));

// ---------- Pago simple / historial (TDSI-85/262/271/272) ----------

/**
 * El ID de transaccion ya no lo escribe el cajero: se genera aqui mismo con el
 * correlativo de la propia tabla (nextval de su secuencia), asi queda unico
 * por construccion, sin depender de que el cajero no repita un numero.
 */
async function insertarTransaccionSimple({ metodo, monto, nit, razon_social, tipo_documento, telefono, caja_id, turno_id, cajero, cajero_id, monto_recibido, vuelto, cobro_duplicado, moneda_recibida, monto_usd, tipo_cambio }) {
  const { rows } = await query(
    `WITH nuevo AS (
       SELECT nextval(pg_get_serial_sequence('pagos.transacciones', 'id')) AS id
     )
     INSERT INTO pagos.transacciones
       (id, id_transaccion, metodo, monto, tipo_pago, nit, razon_social, tipo_documento, telefono, caja_id, turno_id, cajero, cajero_id, monto_recibido, vuelto, cobro_duplicado, moneda_recibida, monto_usd, tipo_cambio)
     SELECT id, 'VTA-' || lpad(id::text, 6, '0'), $1, $2, 'Simple', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
     FROM nuevo
     RETURNING *`,
    [metodo, monto, nit || null, razon_social || null, tipo_documento || null, telefono || null, caja_id || null, turno_id || null, cajero || null, cajero_id || null, monto_recibido ?? null, vuelto ?? null, cobro_duplicado || false, moneda_recibida || null, monto_usd ?? null, tipo_cambio ?? null]
  );
  return {
    ...rows[0],
    monto: num(rows[0].monto),
    monto_recibido: num(rows[0].monto_recibido),
    vuelto: num(rows[0].vuelto),
    monto_usd: num(rows[0].monto_usd),
    tipo_cambio: num(rows[0].tipo_cambio),
  };
}

// ---------- Cobro con QR (TDSI-39/155) ----------

/**
 * Crea el registro de cobro pendiente: la referencia interna se genera con
 * el mismo correlativo de la tabla (igual que VTA-NNNNNN en transacciones),
 * asi queda unica por construccion.
 */
async function crearCobroQr({ monto, minutosVencimiento, caja_id, cajero }) {
  const { rows } = await query(
    `WITH nuevo AS (
       SELECT nextval(pg_get_serial_sequence('pagos.cobros_qr', 'id')) AS id
     )
     INSERT INTO pagos.cobros_qr
       (id, referencia, monto, expira_en, caja_id, cajero)
     SELECT id, 'COB-' || lpad(id::text, 6, '0'), $1, now() + ($2 || ' minutes')::interval, $3, $4
     FROM nuevo
     RETURNING *`,
    [monto, minutosVencimiento, caja_id || null, cajero || null]
  );
  return { ...rows[0], monto: num(rows[0].monto) };
}

/** TDSI-532: consultar el estado actual de un cobro pendiente (Pendiente/Pagado/Expirado). */
async function obtenerCobroQrPorId(id) {
  const { rows } = await query(`SELECT * FROM pagos.cobros_qr WHERE id = $1`, [id]);
  if (!rows.length) return null;
  return { ...rows[0], monto: num(rows[0].monto) };
}

/**
 * TDSI-533/534: el cajero confirma a mano que vio llegar el deposito. El
 * WHERE hace que esto sea atomico por construccion: si el cobro ya estaba
 * Pagado, Expirado, o si ya paso su expira_en (aunque nadie lo haya marcado
 * Expirado todavia), no actualiza ninguna fila y devuelve null -- asi un
 * cobro vencido nunca se puede confirmar, se haya "limpiado" o no.
 */
async function confirmarCobroQr(id, confirmado_por) {
  const { rows } = await query(
    `UPDATE pagos.cobros_qr
     SET estado = 'Pagado', confirmado_en = now(), confirmado_por = $2
     WHERE id = $1 AND estado = 'Pendiente' AND expira_en >= now()
     RETURNING *`,
    [id, confirmado_por]
  );
  if (!rows.length) return null;
  return { ...rows[0], monto: num(rows[0].monto) };
}

/**
 * TDSI-534: pasa un cobro Pendiente vencido a Expirado. Se llama "de paso"
 * cada vez que se consulta o se intenta confirmar un cobro -- no hace falta
 * un cron aparte, con que se revise en esos dos puntos alcanza.
 */
async function expirarCobroQrSiVencido(id) {
  const { rows } = await query(
    `UPDATE pagos.cobros_qr
     SET estado = 'Expirado'
     WHERE id = $1 AND estado = 'Pendiente' AND expira_en < now()
     RETURNING *`,
    [id]
  );
  if (!rows.length) return null;
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
  return rows.map((r) => ({ ...r, monto: num(r.monto), monto_usd: num(r.monto_usd), tipo_cambio: num(r.tipo_cambio) }));
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
 * TDSI-163/825/827: Busca si el mismo cajero ya cobró el mismo monto al mismo
 * NIT/CI en los últimos 2 minutos (120 segundos). No cuenta ventas anuladas.
 * Agrupa por id_transaccion para manejar pagos mixtos (varias filas) y compara la SUMA.
 */
async function buscarPosibleDuplicado({ cajero_id, nit, total, segundos_ventana = 120 }) {
  const { rows } = await query(
    `SELECT id_transaccion, MAX(fecha) AS fecha,
            EXTRACT(EPOCH FROM (now() - MAX(fecha)))::int AS segundos,
            SUM(monto) AS total_agrupado
       FROM pagos.transacciones
      WHERE cajero_id = $1
        AND nit = $2
        AND estado = 'Registrado'
        AND fecha >= now() - ($3 || ' seconds')::interval
      GROUP BY id_transaccion
      HAVING SUM(monto) = $4
      ORDER BY MAX(fecha) DESC
      LIMIT 1`,
    [cajero_id, nit, segundos_ventana, total]
  );
  return rows[0] || null;
}


/** Escapa %, _ y \ para que el texto del buscador se tome literal dentro de un LIKE. */
const escaparLike = (texto) => texto.replace(/[\\%_]/g, "\\$&");

// TDSI-864: el buscador no distingue mayusculas ni tildes ("jose perez" encuentra a "José Pérez").
// Las mayusculas con tilde tambien van en la lista por si la BD usa un locale que no las baja con lower().
const CON_TILDE = "ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ";
const SIN_TILDE = "aaaaeeeeiiiioooouuuunaaaaeeeeiiiioooouuuun";
const sinTildesSql = (columna) => `translate(lower(${columna}), '${CON_TILDE}', '${SIN_TILDE}')`;
const sinTildes = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * TDSI-169: condicion del buscador de "Facturas".
 * - Solo digitos, hasta 6 (ej. "54" o "000054"), o con el prefijo ("VTA-54", "vta 54"):
 *   N° de factura -> VTA-000054 exacto.
 * - Solo digitos, 7 o mas: NIT (10 digitos) o CI (7-8), por prefijo.
 * - Cualquier otro texto: parte del N° de factura ("VTA-0000") o del nombre del cliente.
 */
function agregarBusqueda(q, condiciones, params) {
  // "VTA-54", "vta 54" o "VTA54" tambien son el N° de factura 54. Con ceros a la izquierda
  // y menos de 6 digitos ("VTA-0000") se deja como busqueda parcial, por si sigue escribiendo.
  const conPrefijo = /^vta[-\s]?(\d{1,6})$/i.exec(q);
  if (conPrefijo && (conPrefijo[1].length === 6 || !conPrefijo[1].startsWith("0"))) {
    q = conPrefijo[1];
  }
  if (/^\d{1,6}$/.test(q)) {
    // Se compara como texto sin ceros a la izquierda (no ::bigint): un id con mas de 19
    // digitos al final (ej. uno importado) hacia fallar toda la busqueda con "out of range".
    params.push(q.replace(/^0+/, "") || "0");
    condiciones.push(`COALESCE(NULLIF(ltrim(substring(id_transaccion from '(\\d+)$'), '0'), ''), '0') = $${params.length}`);
  } else if (/^\d{7,}$/.test(q)) {
    params.push(`${q}%`);
    condiciones.push(`nit LIKE $${params.length}`);
  } else {
    params.push(`%${escaparLike(sinTildes(q))}%`);
    const i = params.length;
    condiciones.push(`(lower(id_transaccion) LIKE $${i} OR ${sinTildesSql("razon_social")} LIKE $${i})`);
  }
}

/**
 * TDSI-306: lista "una fila por venta" (agrupa por id_transaccion, asi un pago
 * mixto con 2 metodos aparece una sola vez) de las ventas de un cajero.
 * TDSI-307/865: desde/hasta ("YYYY-MM-DD") filtran por dia de emision en hora de Bolivia,
 * "hasta" inclusive.
 * TDSI-169: q (opcional) agrega la condicion del buscador; se combina con las fechas.
 * TDSI-866: cajero llega en minusculas. Todas las condiciones van unidas con AND, asi
 * la busqueda solo achica la lista: nunca devuelve ventas de otro cajero.
 */
async function listarPorCajero(cajero, { desde, hasta, q } = {}) {
  const condiciones = ["lower(trim(cajero)) = $1"];
  const params = [cajero];
  if (desde) {
    params.push(desde);
    condiciones.push(`fecha >= ($${params.length}::date)::timestamp AT TIME ZONE 'America/La_Paz'`);
  }
  if (hasta) {
    params.push(hasta);
    condiciones.push(`fecha < ($${params.length}::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'`);
  }
  if (q) agregarBusqueda(q, condiciones, params);

  const { rows } = await query(
    `SELECT id_transaccion,
            MIN(fecha) AS fecha,
            SUM(monto) AS total,
            MAX(tipo_pago) AS tipo_pago,
            array_agg(metodo ORDER BY id) AS metodos,
            MAX(nit) AS nit,
            MAX(razon_social) AS razon_social,
            MAX(tipo_documento) AS tipo_documento,
            MAX(telefono) AS telefono,
            MAX(caja_id) AS caja_id,
            bool_and(estado = 'Anulado') AS anulado,
            bool_or(estado = 'AnulacionSolicitada') AS anulacion_solicitada
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
    telefono: r.telefono,
    caja_id: r.caja_id,
    // TDSI-28: la venta con una anulacion pendiente se muestra como "Anulacion solicitada"
    estado: r.anulado ? 'Anulado' : r.anulacion_solicitada ? 'AnulacionSolicitada' : 'Registrado',
  }));
}

/**
 * Anula TODAS las filas de una venta (una si es Simple, varias si es Mixto) en una
 * transaccion SQL. TDSI-929: ademas de quien autorizo (anulado_por = su id), guarda
 * su NOMBRE y el motivo, para poder mostrarlos en el cierre de caja.
 */
async function anularTransaccion(id_transaccion, { anulado_por, anulado_por_nombre, motivo }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE pagos.transacciones
          SET estado = 'Anulado', anulado_por = $2, anulado_por_nombre = $3, motivo_anulacion = $4, anulado_en = now()
        WHERE id_transaccion = $1 AND estado = 'Registrado'
        RETURNING *`,
      [id_transaccion, anulado_por || null, anulado_por_nombre || null, motivo || null]
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
 * TDSI-37/545: corrige datos de facturacion de una venta ya registrada,
 * manteniendo su id_transaccion. Solo actualiza las filas con estado
 * 'Registrado' (si fuera un pago Mixto con 2 filas, corrige las dos).
 */
async function actualizarDatosVenta(id_transaccion, { nit, razon_social, tipo_documento, telefono, modificado_por, autorizado_por }) {
  const columnas = { nit, razon_social, tipo_documento, telefono };
  const camposTocados = Object.keys(columnas).filter((c) => columnas[c] !== undefined);

  return withTransaction(async (client) => {
    // TDSI-546: se lee el valor "anterior" antes de pisarlo, para la bitacora.
    const { rows: antes } = await client.query(
      `SELECT * FROM pagos.transacciones WHERE id_transaccion = $1 AND estado = 'Registrado' FOR UPDATE`,
      [id_transaccion]
    );
    if (antes.length === 0) {
      throw new AppError("La venta ya no se puede modificar (no existe o fue anulada justo ahora).", 409);
    }

    const sets = ["fecha_modificacion = now()", "modificado_por = $2", "autorizado_por = $3"];
    const params = [id_transaccion, modificado_por, autorizado_por];
    for (const columna of camposTocados) {
      params.push(columnas[columna]);
      sets.push(`${columna} = $${params.length}`);
    }

    const { rows: despues } = await client.query(
      `UPDATE pagos.transacciones
          SET ${sets.join(", ")}
        WHERE id_transaccion = $1 AND estado = 'Registrado'
        RETURNING *`,
      params
    );

    // Una fila de bitacora por cada campo que de verdad cambio (si era Mixto,
    // por cada fila de la venta: ej. 2 filas x 1 campo cambiado = 2 registros).
    for (const filaAntes of antes) {
      const filaDespues = despues.find((r) => r.id === filaAntes.id);
      for (const campo of camposTocados) {
        const valorAnterior = filaAntes[campo];
        const valorNuevo = filaDespues[campo];
        if (String(valorAnterior ?? "") === String(valorNuevo ?? "")) continue;
        await client.query(
          `INSERT INTO pagos.bitacora_modificaciones
             (id_transaccion, campo, valor_anterior, valor_nuevo, modificado_por, autorizado_por)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id_transaccion, campo, valorAnterior, valorNuevo, modificado_por, autorizado_por]
        );
      }
    }

    return despues.map((r) => ({ ...r, monto: num(r.monto) }));
  });
}

/** TDSI-546: historial de modificaciones de una venta, mas reciente primero. */
async function listarBitacoraModificaciones(id_transaccion) {
  const { rows } = await query(
    `SELECT id, campo, valor_anterior, valor_nuevo, modificado_por, autorizado_por, modificado_en
       FROM pagos.bitacora_modificaciones
      WHERE id_transaccion = $1
      ORDER BY modificado_en DESC`,
    [id_transaccion]
  );
  return rows;
}

/**
 * TDSI-323: reporte de ventas de una caja en un rango de tiempo (el turno actual),
 * para el cierre de caja: cuanto se gano por metodo, cuantas ventas, cuantas anuladas.
 * TDSI-30: solo cuentan como ingreso los cobros aprobados; un cobro rechazado o
 * pendiente no entro a la caja (igual que en monitoreo y en metodos de pago).
 */
async function reporteTurno(caja_id, desde, hasta) {
  const { rows: porMetodo } = await query(
    `SELECT metodo, SUM(monto) AS total, COUNT(*)::int AS operaciones
       FROM pagos.transacciones
      WHERE caja_id = $1 AND estado = 'Registrado' AND estado_pago = 'APROBADA' AND fecha >= $2 AND fecha <= $3
      GROUP BY metodo`,
    [caja_id, desde, hasta]
  );

  const { rows: ventas } = await query(
    `SELECT id_transaccion, SUM(monto) AS total, bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE caja_id = $1 AND fecha >= $2 AND fecha <= $3
      GROUP BY id_transaccion
     HAVING bool_and(estado = 'Anulado') OR bool_and(estado_pago = 'APROBADA')`,
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
 * TDSI-929: lista (una fila por venta, igual que listarPorCajero) de las facturas
 * anuladas de una caja en un rango de tiempo (el turno), con su motivo y el
 * supervisor que autorizo -- para "Ver anuladas" en el cierre de caja (TDSI-49).
 * Se filtra por "fecha" (la de la venta, no la de la anulacion): una factura
 * emitida dentro del turno y anulada despues igual pertenece a ese turno.
 */
async function listarAnuladasTurno(caja_id, desde, hasta) {
  const { rows } = await query(
    `SELECT id_transaccion,
            MIN(fecha) AS fecha,
            SUM(monto) AS total,
            MAX(motivo_anulacion) AS motivo,
            COALESCE(MAX(anulado_por_nombre), MAX(anulado_por)) AS supervisor,
            MAX(anulado_en) AS anulado_en
       FROM pagos.transacciones
      WHERE caja_id = $1 AND estado = 'Anulado' AND fecha >= $2 AND fecha <= $3
      GROUP BY id_transaccion
      ORDER BY MIN(fecha)`,
    [caja_id, desde, hasta]
  );
  return rows.map((r) => ({
    numero_factura: r.id_transaccion,
    hora: r.fecha,
    total: num(r.total),
    motivo: r.motivo,
    supervisor: r.supervisor,
    anulado_en: r.anulado_en,
  }));
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
 * TDSI-21: tambien alimenta el Lote de Cierre Diario, asi que solo cuentan los
 * cobros aprobados (un cobro rechazado o pendiente no es ingreso).
 */
async function totalesGenerales(desde, hasta) {
  const { rows: porMetodo } = await query(
    `SELECT metodo, SUM(monto) AS total, COUNT(*)::int AS operaciones
       FROM pagos.transacciones
      WHERE estado = 'Registrado' AND estado_pago = 'APROBADA' AND fecha >= $1 AND fecha <= $2
      GROUP BY metodo`,
    [desde, hasta]
  );

  const { rows: ventas } = await query(
    `SELECT id_transaccion, SUM(monto) AS total, bool_and(estado = 'Anulado') AS anulado
       FROM pagos.transacciones
      WHERE fecha >= $1 AND fecha <= $2
      GROUP BY id_transaccion
     HAVING bool_and(estado = 'Anulado') OR bool_and(estado_pago = 'APROBADA')`,
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
async function registrarPagoMixtoCompleto({ id_transaccion, cajaId, turnoId, total, metodos, nit, razon_social, tipo_documento, telefono, cajero, cajeroId, cobro_duplicado }) {
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
        `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id, nit, razon_social, tipo_documento, telefono, cajero, caja_id, cajero_id, cobro_duplicado)
         VALUES ($1, $2, $3, 'Mixto', $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [pago.id_transaccion, d.metodo, d.monto, pago.id, nit || null, razon_social || null, tipo_documento || null, telefono || null, cajero || null, cajaId || null, cajeroId || null, cobro_duplicado || false]
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

/** TDSI-38/527: trae el token de verificacion de una venta, o null si no tiene (Mixto comparte uno solo entre sus filas). */
async function obtenerTokenVerificacion(id_transaccion) {
  const { rows } = await query(
    `SELECT token_verificacion FROM pagos.transacciones WHERE id_transaccion = $1 LIMIT 1`,
    [id_transaccion]
  );
  return rows[0]?.token_verificacion || null;
}

/** TDSI-38/527: guarda el token (en todas las filas de la venta) solo si todavia no tenia uno. */
async function guardarTokenVerificacion(id_transaccion, token) {
  await query(
    `UPDATE pagos.transacciones SET token_verificacion = $2 WHERE id_transaccion = $1 AND token_verificacion IS NULL`,
    [id_transaccion, token]
  );
}

/** TDSI-38/528: busca la venta por su token de verificacion (para el QR escaneado). */
async function buscarPorTokenVerificacion(token) {
  const { rows } = await query(
    `SELECT * FROM pagos.transacciones WHERE token_verificacion = $1`,
    [token]
  );
  return rows.map((r) => ({ ...r, monto: num(r.monto) }));
}

module.exports = {
  crearCobroQr,
  obtenerCobroQrPorId,
  confirmarCobroQr,
  expirarCobroQrSiVencido,
  insertarTransaccionSimple,
  buscarTransaccionesPorIdTransaccion,
  buscarTodasTransaccionesPorIdTransaccion,
  buscarRazonSocialPorDocumento,
  obtenerTokenVerificacion,
  guardarTokenVerificacion,
  buscarPorTokenVerificacion,
  listarPorCajero,
  anularTransaccion,
  actualizarDatosVenta,
  listarBitacoraModificaciones,
  reporteTurno,
  listarAnuladasTurno,
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
  buscarPosibleDuplicado,
};