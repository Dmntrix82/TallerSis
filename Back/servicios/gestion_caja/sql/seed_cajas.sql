-- TDSI-24/463: semilla de cajas de demostracion para probar Estado de cajas,
-- Solicitudes de apertura/cierre y Total recaudado (TDSI-24, 25, 26 y 30).
-- Opcional: correr en el SQL Editor de Supabase DESPUES de script_caja.sql.
-- Los codigos DEMO-CAJA-1..3 son las cajas que usan las semillas de gestion_pagos
-- (semilla_monitoreo.sql y seed_revision.sql). Se puede correr varias veces.

INSERT INTO caja.cajas (codigo, nombre, estado) VALUES
    ('DEMO-CAJA-1', 'Caja 1 (demo)',      'ACTIVA'),
    ('DEMO-CAJA-2', 'Caja 2 (demo)',      'ACTIVA'),
    ('DEMO-CAJA-3', 'Caja 3 (demo)',      'ACTIVA'),
    ('DEMO-CAJA-4', 'Caja 4 (inactiva)',  'INACTIVA'),
    ('DEMO-CAJA-5', 'Caja 5 (sin turno)', 'ACTIVA')
ON CONFLICT (codigo) DO NOTHING;

-- Turno abierto en DEMO-CAJA-1 para que aparezca como "Abierta" y se pueda pedir su cierre.
INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, efectivo_inicial, estado)
SELECT 'T-DEMO-01', 'DEMO-CAJA-1', 'ana.demo@tallersis.bo', 'Ana Demo', 100, 'ABIERTO'
 WHERE NOT EXISTS (SELECT 1 FROM caja.turnos WHERE caja_id = 'DEMO-CAJA-1' AND estado = 'ABIERTO')
ON CONFLICT (codigo) DO NOTHING;
