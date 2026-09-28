CREATE SCHEMA IF NOT EXISTS proveedores;

-- TDSI-391/392/393/408/409: orden de pago recibida desde el modulo de Compras
CREATE TABLE IF NOT EXISTS proveedores.ordenes_pago (
    id                      BIGSERIAL PRIMARY KEY,
    numero                  VARCHAR(20)  NOT NULL UNIQUE,
    orden_compra_id         VARCHAR(60)  NOT NULL UNIQUE,
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
                             CHECK (estado IN ('PENDIENTE','LIQUIDADA')),
    creado_en               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    liquidada_en            TIMESTAMPTZ,
    liquidada_por           VARCHAR(60)
);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado    ON proveedores.ordenes_pago (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_proveedor ON proveedores.ordenes_pago (proveedor_nit);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha     ON proveedores.ordenes_pago (fecha_vencimiento);

-- TDSI-394: notificacion al administrador cuando llega una orden pendiente
CREATE TABLE IF NOT EXISTS proveedores.notificaciones_admin (
    id              BIGSERIAL PRIMARY KEY,
    orden_pago_id   BIGINT NOT NULL REFERENCES proveedores.ordenes_pago(id) ON DELETE CASCADE,
    mensaje         VARCHAR(300) NOT NULL,
    leida           BOOLEAN      NOT NULL DEFAULT false,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- TDSI-399/400/401/402: egreso de dinero por pago a proveedor
CREATE TABLE IF NOT EXISTS proveedores.egresos (
    id              BIGSERIAL PRIMARY KEY,
    orden_pago_id   BIGINT NOT NULL REFERENCES proveedores.ordenes_pago(id),
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
    intentos          INT NOT NULL DEFAULT 0,
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

ALTER TABLE proveedores.ordenes_pago            ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.notificaciones_admin    ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.egresos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.confirmaciones_compras  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.lotes_cierre_diario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores.envios_contabilidad     ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- TDSI-20/119/407-410: confirmacion "Pago Realizado" a Compras
-- Amplia la tabla existente sin modificar su estructura base.
-- ==========================================================================

ALTER TABLE proveedores.confirmaciones_compras
    ADD COLUMN IF NOT EXISTS solicitado_por      VARCHAR(60),
    ADD COLUMN IF NOT EXISTS payload             JSONB,
    ADD COLUMN IF NOT EXISTS ultimo_status       INT,
    ADD COLUMN IF NOT EXISTS ultimo_error        VARCHAR(400),
    ADD COLUMN IF NOT EXISTS proximo_intento_en  TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS creado_en           TIMESTAMPTZ DEFAULT now();

ALTER TABLE proveedores.ordenes_pago
    ADD COLUMN IF NOT EXISTS confirmado_por  VARCHAR(60),
    ADD COLUMN IF NOT EXISTS confirmado_en   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_confirmacion_activa
    ON proveedores.confirmaciones_compras (orden_pago_id)
    WHERE estado IN ('PENDIENTE','ENVIADO');

CREATE INDEX IF NOT EXISTS idx_confirmaciones_pendientes
    ON proveedores.confirmaciones_compras (proximo_intento_en)
    WHERE estado = 'PENDIENTE';