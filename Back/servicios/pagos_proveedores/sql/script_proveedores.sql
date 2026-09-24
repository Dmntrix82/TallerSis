CREATE SCHEMA IF NOT EXISTS proveedores;

-- TDSI-391/392/393/408/409: orden de pago recibida desde el modulo de Compras
CREATE TABLE IF NOT EXISTS proveedores.ordenes_pago (
    id                      BIGSERIAL PRIMARY KEY,
    numero                  VARCHAR(20)  NOT NULL UNIQUE,
    orden_compra_id         VARCHAR(60)  NOT NULL UNIQUE,        -- TDSI-391
    proveedor_nit           VARCHAR(30)  NOT NULL,
    proveedor_razon_social  VARCHAR(150) NOT NULL,
    proveedor_cuenta_bancaria VARCHAR(40) NOT NULL,
    proveedor_banco         VARCHAR(80)  NOT NULL,
    proveedor_contacto      VARCHAR(60),
    monto                   NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    moneda                  VARCHAR(10)  NOT NULL DEFAULT 'BOB',
    fecha_vencimiento       DATE,
    concepto                VARCHAR(200),
    estado                  VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                             CHECK (estado IN ('PENDIENTE','LIQUIDADA')),  -- TDSI-393/408
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    liquidada_en            TIMESTAMPTZ,
    liquidada_por           VARCHAR(60)                          -- TDSI-409
);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado    ON proveedores.ordenes_pago (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_proveedor ON proveedores.ordenes_pago (proveedor_nit);   -- TDSI-397
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha     ON proveedores.ordenes_pago (fecha_vencimiento);

-- TDSI-394: notificacion al administrador cuando llega una orden pendiente
CREATE TABLE IF NOT EXISTS proveedores.notificaciones_admin (
    id              BIGSERIAL PRIMARY KEY,
    orden_pago_id   BIGINT NOT NULL REFERENCES proveedores.ordenes_pago(id) ON DELETE CASCADE,
    mensaje         VARCHAR(300) NOT NULL,
    leida           BOOLEAN      NOT NULL DEFAULT false,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- TDSI-399/400/401/402: egreso de dinero por pago a proveedor (funciona como el
-- historial de movimientos financieros de este schema; TDSI-402)
CREATE TABLE IF NOT EXISTS proveedores.egresos (
    id              BIGSERIAL PRIMARY KEY,
    orden_pago_id   BIGINT NOT NULL REFERENCES proveedores.ordenes_pago(id),   -- TDSI-400
    monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    metodo          VARCHAR(20)  NOT NULL DEFAULT 'TRANSFERENCIA',
    descripcion     VARCHAR(200),
    registrado_por  VARCHAR(60),
    registrado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_egresos_orden ON proveedores.egresos (orden_pago_id);

-- TDSI-407/410: confirmacion "Pago Realizado" enviada de vuelta al modulo de Compras
CREATE TABLE IF NOT EXISTS proveedores.confirmaciones_compras (
    id                BIGSERIAL PRIMARY KEY,
    orden_pago_id     BIGINT NOT NULL REFERENCES proveedores.ordenes_pago(id) ON DELETE CASCADE,
    estado            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','ERROR')),
    intentos          INT NOT NULL DEFAULT 0,                    -- TDSI-410
    ultimo_intento_en TIMESTAMPTZ,
    enviado_en        TIMESTAMPTZ
);

-- TDSI-21/120/121: lote de cierre diario (ingresos/egresos/impuestos consolidados)
CREATE TABLE IF NOT EXISTS proveedores.lotes_cierre_diario (
    id                BIGSERIAL PRIMARY KEY,
    fecha             DATE          NOT NULL UNIQUE,
    total_ingresos    NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_egresos     NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_impuestos   NUMERIC(14,2) NOT NULL DEFAULT 0,
    estado            VARCHAR(20)   NOT NULL DEFAULT 'GENERADO' CHECK (estado IN ('GENERADO','ENVIADO')),
    generado_por      VARCHAR(60),
    generado_en       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- TDSI-122: envio del reporte del lote a Contabilidad
CREATE TABLE IF NOT EXISTS proveedores.envios_contabilidad (
    id              BIGSERIAL PRIMARY KEY,
    lote_id         BIGINT NOT NULL REFERENCES proveedores.lotes_cierre_diario(id) ON DELETE CASCADE,
    estado          VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','ERROR')),
    intentos        INT NOT NULL DEFAULT 0,
    enviado_en      TIMESTAMPTZ
);

-- NOTA: los totales de lotes_cierre_diario se calculan agregando datos de OTROS
-- microservicios (pagos, caja, facturacion) via HTTP -- no se hace JOIN directo
-- entre schemas. TDSI-16/111/112 (tablero consolidado de ingresos) es de alcance
-- cruzado entre microservicios; no se modela tabla propia aqui.

ALTER TABLE proveedores.ordenes_pago            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.notificaciones_admin    ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.egresos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.confirmaciones_compras  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.lotes_cierre_diario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.envios_contabilidad     ENABLE ROW LEVEL SECURITY;