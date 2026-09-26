-- ==========================================================================
-- Script de base de datos: schema pagos
-- Proyecto: Taller de Sistemas de Informacion
-- Servicio: gestion_pagos (puerto 4005)
--
-- Cubre:
--   - Pago simple y mixto (TDSI-85/87/262/271/272/275/276/277)
--   - Autenticacion del Sistema Cliente externo (TDSI-103/104/335-338)
--   - Recepcion de venta online (TDSI-105/106/343-346)
--   - Historial de estados (TDSI-109/359-362)
--   - Anulacion de pago online (TDSI-110/367-370)
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS pagos;

-- NOTA: NO existe pagos.clientes_frecuentes aquí.
-- El NIT/Razon Social pertenece al dominio de FACTURACION (TDSI-5, epic EPIC-03).
-- Si gestion_pagos necesita guardar un cliente, lo hace via HTTP hacia facturacion,
-- nunca escribe directo en su tabla. Ver src/services/clientesProxy.js

-- TDSI-85/262/271/272 (pago simple) + TDSI-277 (una fila por metodo del pago mixto)
-- nit/razon_social aqui son una "foto" del momento del pago (para el recibo/historial),
-- NO son la fuente de verdad del cliente -- esa vive solo en facturacion.
CREATE TABLE IF NOT EXISTS pagos.transacciones (
    id              BIGSERIAL PRIMARY KEY,
    id_transaccion  VARCHAR(60)   NOT NULL,
    metodo          VARCHAR(20)   NOT NULL CHECK (metodo IN ('Efectivo','Tarjeta','QR')),
    monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    tipo_pago       VARCHAR(20)   NOT NULL DEFAULT 'Simple' CHECK (tipo_pago IN ('Simple','Mixto')),
    nit             VARCHAR(30),
    razon_social    VARCHAR(150),
    estado          VARCHAR(20)   NOT NULL DEFAULT 'Registrado' CHECK (estado IN ('Registrado','Anulado')),
    pago_mixto_id   BIGINT,
    fecha           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_transaccion_metodo UNIQUE (id_transaccion, metodo)
);
CREATE INDEX IF NOT EXISTS idx_transacciones_id_transaccion ON pagos.transacciones (id_transaccion);
CREATE INDEX IF NOT EXISTS idx_transacciones_pago_mixto ON pagos.transacciones (pago_mixto_id);

-- TDSI-87/275/276: cabecera del pago mixto
CREATE TABLE IF NOT EXISTS pagos.pagos_mixtos (
    id              BIGSERIAL PRIMARY KEY,
    id_transaccion  VARCHAR(60)   NOT NULL UNIQUE,
    caja_id         VARCHAR(60),
    turno_id        VARCHAR(60),
    tipo_pago       VARCHAR(20)   NOT NULL DEFAULT 'Mixto' CHECK (tipo_pago IN ('Mixto')),
    total           NUMERIC(14,2) NOT NULL CHECK (total > 0),
    estado          VARCHAR(20)   NOT NULL DEFAULT 'Registrado' CHECK (estado IN ('Registrado','Anulado')),
    fecha           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- FK de transacciones.pago_mixto_id -> pagos_mixtos.id
-- Idempotente: si ya existe, no falla. Se puede correr el script N veces.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_transacciones_pago_mixto'
          AND conrelid = 'pagos.transacciones'::regclass
    ) THEN
        ALTER TABLE pagos.transacciones
            ADD CONSTRAINT fk_transacciones_pago_mixto
            FOREIGN KEY (pago_mixto_id) REFERENCES pagos.pagos_mixtos(id) ON DELETE CASCADE;
    END IF;
END $$;

-- TDSI-276: detalle del pago mixto (montos y metodos)
CREATE TABLE IF NOT EXISTS pagos.detalles_pago (
    id          BIGSERIAL PRIMARY KEY,
    pago_id     BIGINT        NOT NULL REFERENCES pagos.pagos_mixtos(id) ON DELETE CASCADE,
    metodo      VARCHAR(20)   NOT NULL CHECK (metodo IN ('Efectivo','Tarjeta','QR')),
    monto       NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    porcentaje  NUMERIC(5,2),
    referencia  VARCHAR(120),
    orden       SMALLINT      NOT NULL,
    fecha       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (pago_id, orden)
);

-- ==============================================================
-- Tablas preparadas para HU futuras del mismo microservicio (aun sin codigo)
-- ==============================================================

-- TDSI-103/104/335-338: autenticacion del Sistema Cliente externo.
-- Se guarda el secret CIFRADO (scrypt), nunca en texto plano. El token es JWT
-- y su vigencia la resuelve el propio token, asi que no hay tabla de tokens.
CREATE TABLE IF NOT EXISTS pagos.sistemas_cliente (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(60)  NOT NULL UNIQUE,
    nombre          VARCHAR(120) NOT NULL,
    secret_hash     VARCHAR(255) NOT NULL,
    activo          BOOLEAN      NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ultimo_acceso   TIMESTAMPTZ
);

-- TDSI-105/106/343-346: recepcion de venta online
CREATE TABLE IF NOT EXISTS pagos.ventas_online (
    id                  BIGSERIAL PRIMARY KEY,
    orden_id            VARCHAR(60)  NOT NULL UNIQUE,
    cliente_id          VARCHAR(60),
    total               NUMERIC(14,2) NOT NULL CHECK (total > 0),
    metodo_pago         VARCHAR(20)  NOT NULL CHECK (metodo_pago IN ('Efectivo','Tarjeta','QR')),
    estado              VARCHAR(20)  NOT NULL DEFAULT 'Pagado' CHECK (estado IN ('Pagado','Anulado')),
    despachada          BOOLEAN      NOT NULL DEFAULT false,
    codigo_confirmacion VARCHAR(60)  NOT NULL,
    recibida_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos.venta_online_items (
    id              BIGSERIAL PRIMARY KEY,
    venta_id        BIGINT NOT NULL REFERENCES pagos.ventas_online(id) ON DELETE CASCADE,
    sku             VARCHAR(60)  NOT NULL,
    descripcion     VARCHAR(200),
    cantidad        NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal        NUMERIC(14,2) NOT NULL
);

-- TDSI-109/359-362: historial de cambios de estado de una transaccion
CREATE TABLE IF NOT EXISTS pagos.historial_estados_transaccion (
    id              BIGSERIAL PRIMARY KEY,
    id_transaccion  VARCHAR(60)  NOT NULL,
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20)  NOT NULL,
    cambiado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historial_id_trx ON pagos.historial_estados_transaccion (id_transaccion);

-- TDSI-110/367-370: anulacion de pago online
CREATE TABLE IF NOT EXISTS pagos.anulaciones_online (
    id              BIGSERIAL PRIMARY KEY,
    orden_id        VARCHAR(60)  NOT NULL REFERENCES pagos.ventas_online(orden_id),
    motivo          VARCHAR(300) NOT NULL,
    solicitado_por  VARCHAR(60),
    anulado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    notificado      BOOLEAN      NOT NULL DEFAULT false
);

-- Datos semilla (mismos valores que tenian en memoria.js; los usan los tests)
INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, turno_id, total, estado)
VALUES ('SEED-NO-USAR', 'SEED', 'SEED', 1, 'Anulado')
ON CONFLICT (id_transaccion) DO NOTHING;
DELETE FROM pagos.pagos_mixtos WHERE id_transaccion = 'SEED-NO-USAR';

ALTER TABLE pagos.transacciones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.pagos_mixtos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.detalles_pago               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.sistemas_cliente            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.ventas_online               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.venta_online_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.historial_estados_transaccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos.anulaciones_online          ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- TDSI-109/359-362: estado_pago (resultado del pago) + historial de cambios
-- ==========================================================================

-- TDSI-109/360: agregar estado_pago (resultado del cobro) + actualizado_en
-- 'estado' sigue existiendo para el ciclo de vida del registro (Registrado/Anulado).
-- 'estado_pago' es un concepto distinto: el resultado del cobro (PENDIENTE/APROBADA/RECHAZADA).
ALTER TABLE pagos.transacciones
    ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) NOT NULL DEFAULT 'APROBADA'
        CHECK (estado_pago IN ('PENDIENTE','APROBADA','RECHAZADA')),
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

-- TDSI-361: ampliar el historial existente (sin tocar sus columnas actuales)
ALTER TABLE pagos.historial_estados_transaccion
    ADD COLUMN IF NOT EXISTS motivo VARCHAR(200),
    ADD COLUMN IF NOT EXISTS origen VARCHAR(30) NOT NULL DEFAULT 'SISTEMA';

-- TDSI-362: indice para consultar el historial por transaccion
CREATE INDEX IF NOT EXISTS idx_historial_estados_tx
    ON pagos.historial_estados_transaccion (id_transaccion, cambiado_en DESC);