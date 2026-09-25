CREATE SCHEMA IF NOT EXISTS caja;

-- TDSI-24/125/126: catalogo de cajas (terminales) y su estado activo/inactivo
CREATE TABLE IF NOT EXISTS caja.cajas (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL UNIQUE,     -- ej: CAJA-01
    nombre      VARCHAR(80),
    estado      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','INACTIVA'))
);

-- TDSI-83/261/266/267/268: sesion del cajero en el terminal POS
CREATE TABLE IF NOT EXISTS caja.sesiones_cajero (
    id                  BIGSERIAL PRIMARY KEY,
    cajero_id           VARCHAR(60)  NOT NULL,
    cajero_nombre       VARCHAR(150),
    caja_id             VARCHAR(20),
    iniciada_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    cerrada_en          TIMESTAMPTZ,
    cierre_automatico   BOOLEAN      NOT NULL DEFAULT false,     -- TDSI-268: por inactividad
    activa              BOOLEAN      NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_sesiones_cajero ON caja.sesiones_cajero (cajero_id);

-- TDSI-8/9/97/98/99/100/311-322: turno de caja (apertura y cierre)
CREATE TABLE IF NOT EXISTS caja.turnos (
    id                  BIGSERIAL PRIMARY KEY,
    codigo              VARCHAR(20)  NOT NULL UNIQUE,
    caja_id             VARCHAR(20)  NOT NULL,
    cajero_id           VARCHAR(60)  NOT NULL,
    cajero_nombre       VARCHAR(150),
    efectivo_inicial    NUMERIC(14,2) NOT NULL DEFAULT 0,        -- TDSI-311/312
    efectivo_contado    NUMERIC(14,2),                            -- TDSI-320/324
    efectivo_esperado   NUMERIC(14,2),                            -- calculado al cerrar
    diferencia          NUMERIC(14,2),
    tipo_diferencia     VARCHAR(10) CHECK (tipo_diferencia IN ('CUADRA','FALTANTE','SOBRANTE')),
    estado              VARCHAR(20)  NOT NULL DEFAULT 'ABIERTO'
                         CHECK (estado IN ('ABIERTO','CERRADO')),  -- TDSI-322: bloquea nuevas ventas
    abierto_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    cerrado_en          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_turnos_caja_estado ON caja.turnos (caja_id, estado);   -- TDSI-313: no abrir 2 veces
CREATE INDEX IF NOT EXISTS idx_turnos_cajero ON caja.turnos (cajero_id);              -- TDSI-143/144

-- TDSI-277 (via API desde gestion_pagos) + TDSI-401 (via API desde pagos_proveedores)
-- + TDSI-314: registro del efectivo inicial en el historial.
-- Esta tabla es el "resumen de caja" que otros microservicios alimentan por HTTP,
-- segun el diagrama de arquitectura ("Actualiza Resumen de Caja", "Aporta egresos al cierre de caja").
-- gestion_caja NUNCA hace JOIN directo a pagos.transacciones ni a proveedores.egresos.
CREATE TABLE IF NOT EXISTS caja.movimientos (
    id                  BIGSERIAL PRIMARY KEY,
    caja_id             VARCHAR(20)  NOT NULL,
    turno_id            BIGINT       NOT NULL REFERENCES caja.turnos(id) ON DELETE CASCADE,
    tipo                VARCHAR(10)  NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
    metodo              VARCHAR(20)  NOT NULL CHECK (metodo IN ('Efectivo','Tarjeta','QR','Mixto')),
    monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    origen_microservicio VARCHAR(30) NOT NULL DEFAULT 'LOCAL' CHECK (origen_microservicio IN ('LOCAL','PAGOS','PROVEEDORES')),
    referencia_externa  VARCHAR(60),                              -- id_transaccion u orden de pago
    descripcion         VARCHAR(200),
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_turno  ON caja.movimientos (turno_id);      -- TDSI-319/327/328
CREATE INDEX IF NOT EXISTS idx_movimientos_metodo ON caja.movimientos (metodo);        -- TDSI-328/332

-- TDSI-25/26/127-130: autorizacion del supervisor para apertura/cierre de caja
CREATE TABLE IF NOT EXISTS caja.autorizaciones (
    id              BIGSERIAL PRIMARY KEY,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('APERTURA','CIERRE')),
    caja_id         VARCHAR(20)  NOT NULL,
    turno_id        BIGINT       REFERENCES caja.turnos(id),
    solicitado_por  VARCHAR(60),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
    autorizado_por  VARCHAR(60),
    solicitado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resuelto_en     TIMESTAMPTZ
);

-- TDSI-32/141/142: gestion de diferencias (faltantes/sobrantes) detectadas en el cierre
CREATE TABLE IF NOT EXISTS caja.diferencias_resolucion (
    id              BIGSERIAL PRIMARY KEY,
    turno_id        BIGINT       NOT NULL REFERENCES caja.turnos(id) ON DELETE CASCADE,
    monto           NUMERIC(14,2) NOT NULL,
    tipo            VARCHAR(10)  NOT NULL CHECK (tipo IN ('FALTANTE','SOBRANTE')),
    justificacion   VARCHAR(300),
    resuelta_por    VARCHAR(60),
    resuelta_en     TIMESTAMPTZ
);

-- TDSI-35/131/132: operaciones que requieren aprobacion superior (generico, distinto
-- de apertura/cierre) -- ej. revision puntual de una transaccion marcada como sospechosa
CREATE TABLE IF NOT EXISTS caja.aprobaciones_especiales (
    id              BIGSERIAL PRIMARY KEY,
    turno_id        BIGINT       REFERENCES caja.turnos(id),
    tipo            VARCHAR(60)  NOT NULL,
    descripcion     VARCHAR(300),
    solicitado_por  VARCHAR(60),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA')),
    autorizado_por  VARCHAR(60),
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resuelto_en     TIMESTAMPTZ
);

-- NOTA: TDSI-29/135/136 (supervision de devoluciones) y TDSI-151/152 (estado de
-- facturas emitidas) NO crean tabla aqui -- se consultan por HTTP a los
-- microservicios "devoluciones" y "facturacion" respectivamente.
-- NOTA: TDSI-28/95/113/303-306/383-390 (anulacion de factura + PIN) viven en
-- el schema "facturacion" (factura_anulaciones), no aqui.

ALTER TABLE caja.cajas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.sesiones_cajero          ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.turnos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.movimientos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.autorizaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.diferencias_resolucion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja.aprobaciones_especiales  ENABLE ROW LEVEL SECURITY;