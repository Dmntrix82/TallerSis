CREATE SCHEMA IF NOT EXISTS facturacion;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- TDSI-5 / TDSI-91/92/287-290: clientes frecuentes
CREATE TABLE IF NOT EXISTS facturacion.clientes_frecuentes (
    nit             VARCHAR(30)  PRIMARY KEY,
    razon_social    VARCHAR(150) NOT NULL,
    email           VARCHAR(150),
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_nit_trgm
    ON facturacion.clientes_frecuentes USING gin (nit extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_razon_trgm
    ON facturacion.clientes_frecuentes USING gin (lower(razon_social) extensions.gin_trgm_ops);

-- TDSI-42/161/162
CREATE TABLE IF NOT EXISTS facturacion.configuracion_impuestos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(40)  NOT NULL,
    porcentaje  NUMERIC(5,2) NOT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT true
);
INSERT INTO facturacion.configuracion_impuestos (nombre, porcentaje) VALUES ('IVA', 13.00)
ON CONFLICT DO NOTHING;

-- TDSI-38/39/44/46/47/51/89/279-282/303-306
CREATE TABLE IF NOT EXISTS facturacion.facturas (
    id                  BIGSERIAL PRIMARY KEY,
    numero              VARCHAR(20)  NOT NULL UNIQUE,
    venta_id            VARCHAR(60),
    canal               VARCHAR(20)  NOT NULL DEFAULT 'Presencial' CHECK (canal IN ('Presencial','Online')),
    cliente_nit         VARCHAR(30)  REFERENCES facturacion.clientes_frecuentes(nit),
    cliente_nombre      VARCHAR(150),
    con_factura         BOOLEAN      NOT NULL DEFAULT true,
    fecha               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    subtotal            NUMERIC(14,2) NOT NULL,
    descuento           NUMERIC(14,2) NOT NULL DEFAULT 0,
    impuesto            NUMERIC(14,2) NOT NULL DEFAULT 0,
    total               NUMERIC(14,2) NOT NULL CHECK (total > 0),
    estado              VARCHAR(25)  NOT NULL DEFAULT 'Emitida'
                         CHECK (estado IN ('Borrador','Emitida','AnulacionSolicitada','Anulada')),
    bloqueada           BOOLEAN      NOT NULL DEFAULT false,
    cuf                 VARCHAR(80),
    codigo_control      VARCHAR(20),
    impresa             BOOLEAN      NOT NULL DEFAULT false,
    veces_impresa       INT          NOT NULL DEFAULT 0,
    impresa_en          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_facturas_numero  ON facturacion.facturas (numero);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturacion.facturas (cliente_nit);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha   ON facturacion.facturas (fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_estado  ON facturacion.facturas (estado);

CREATE TABLE IF NOT EXISTS facturacion.factura_items (
    id              BIGSERIAL PRIMARY KEY,
    factura_id      BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    descripcion     VARCHAR(200) NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal        NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.factura_impuestos (
    id              BIGSERIAL PRIMARY KEY,
    factura_id      BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    tipo_impuesto   VARCHAR(40)  NOT NULL,
    porcentaje      NUMERIC(5,2) NOT NULL,
    monto           NUMERIC(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion.factura_metodos_pago (
    id          BIGSERIAL PRIMARY KEY,
    factura_id  BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    metodo      VARCHAR(20) NOT NULL CHECK (metodo IN ('Efectivo','Tarjeta','QR')),
    monto       NUMERIC(14,2) NOT NULL CHECK (monto > 0)
);

CREATE TABLE IF NOT EXISTS facturacion.impresiones (
    id              BIGSERIAL PRIMARY KEY,
    factura_numero  VARCHAR(20) NOT NULL REFERENCES facturacion.facturas(numero),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('ORIGINAL','COPIA')),
    motivo          VARCHAR(200),
    job_id          VARCHAR(40),
    impreso_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impresiones_factura ON facturacion.impresiones (factura_numero);

CREATE TABLE IF NOT EXISTS facturacion.factura_documentos (
    id              BIGSERIAL PRIMARY KEY,
    factura_id      BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('PDF','XML')),
    ruta_o_url      TEXT,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'EnProceso' CHECK (estado IN ('EnProceso','Listo','Error')),
    generado_en     TIMESTAMPTZ,
    entregado       BOOLEAN      NOT NULL DEFAULT false,
    entregado_en    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS facturacion.factura_anulaciones (
    id              BIGSERIAL PRIMARY KEY,
    factura_id      BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    motivo          VARCHAR(300) NOT NULL,
    solicitado_por  VARCHAR(60),
    solicitado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'Solicitada' CHECK (estado IN ('Solicitada','Autorizada','Rechazada')),
    autorizado_por  VARCHAR(60),
    autorizado_en   TIMESTAMPTZ,
    pin_intentos    INT          NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS facturacion.factura_envios_contabilidad (
    id                  BIGSERIAL PRIMARY KEY,
    factura_id          BIGINT NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    estado              VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Enviado','Error')),
    intentos            INT         NOT NULL DEFAULT 0,
    ultimo_intento_en   TIMESTAMPTZ,
    enviado_en          TIMESTAMPTZ
);

-- Semillas: clientes usados en los tests de TDSI-5
INSERT INTO facturacion.clientes_frecuentes (nit, razon_social, email) VALUES
    ('1234567',  'Juan Perez',            NULL),
    ('123456789','Juan Pérez',            'juan@example.com'),
    ('987654321','María López',           'maria@example.com'),
    ('555555555','Supermercado El Sol',   'contacto@elsol.com')
ON CONFLICT (nit) DO NOTHING;

-- Semilla: factura usada en tests de tirilla/impresora
INSERT INTO facturacion.facturas
    (numero, venta_id, cliente_nit, cliente_nombre, subtotal, descuento, impuesto, total, impresa, veces_impresa)
VALUES ('F-000001', 'V-1', '1234567', 'Juan Perez', 35, 0, 4.55, 35, false, 0)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO facturacion.factura_items (factura_id, descripcion, cantidad, precio_unitario, subtotal)
SELECT id, 'Arroz 1kg', 2, 10, 20 FROM facturacion.facturas WHERE numero = 'F-000001'
ON CONFLICT DO NOTHING;
INSERT INTO facturacion.factura_items (factura_id, descripcion, cantidad, precio_unitario, subtotal)
SELECT id, 'Aceite 900ml', 1, 15, 15 FROM facturacion.facturas WHERE numero = 'F-000001'
ON CONFLICT DO NOTHING;
INSERT INTO facturacion.factura_metodos_pago (factura_id, metodo, monto)
SELECT id, 'Efectivo', 20 FROM facturacion.facturas WHERE numero = 'F-000001'
ON CONFLICT DO NOTHING;
INSERT INTO facturacion.factura_metodos_pago (factura_id, metodo, monto)
SELECT id, 'QR', 15 FROM facturacion.facturas WHERE numero = 'F-000001'
ON CONFLICT DO NOTHING;

ALTER TABLE facturacion.clientes_frecuentes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.configuracion_impuestos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.facturas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_impuestos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_metodos_pago        ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.impresiones                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_documentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_anulaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.factura_envios_contabilidad ENABLE ROW LEVEL SECURITY;
-- ==========================================================================
-- TDSI-17/113/383-386: supervisores con PIN + ampliacion de anulaciones
-- ==========================================================================

CREATE TABLE IF NOT EXISTS facturacion.supervisores (
    id                  BIGSERIAL PRIMARY KEY,
    supervisor_id       VARCHAR(60)  NOT NULL UNIQUE,
    nombre              VARCHAR(150) NOT NULL,
    pin_hash            VARCHAR(255) NOT NULL,
    activo              BOOLEAN      NOT NULL DEFAULT true,
    intentos_fallidos   INT          NOT NULL DEFAULT 0,
    bloqueado_hasta     TIMESTAMPTZ,
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE facturacion.factura_anulaciones
    ADD COLUMN IF NOT EXISTS autorizado_nombre  VARCHAR(150),
    ADD COLUMN IF NOT EXISTS observacion        VARCHAR(300);

ALTER TABLE facturacion.supervisores ENABLE ROW LEVEL SECURITY;