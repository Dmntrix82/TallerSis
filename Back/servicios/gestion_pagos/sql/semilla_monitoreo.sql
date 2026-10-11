-- ==========================================================================
-- TDSI-23/423: semilla de operaciones para probar el monitoreo de cajeros.
-- SOLO para desarrollo / demo. Ejecutar despues de script_pagos.sql.
--
-- Crea 3 cajeros de demostracion en 2 cajas de demostracion (DEMO-CAJA-1 y
-- DEMO-CAJA-2), con operaciones de los ultimos minutos: aprobadas, una anulada
-- y una rechazada. Usan codigos DEMO-..., asi no se mezclan con cajas reales.
--
-- Se puede volver a correr: borra la semilla anterior y la crea de nuevo con
-- horas actualizadas (util para que el monitoreo "en vivo" muestre datos recientes).
--
-- Para QUITAR la semilla:
--   DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MON-%';
-- ==========================================================================

DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MON-%';

INSERT INTO pagos.transacciones
    (id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero, cajero_id, caja_id, fecha)
VALUES
    -- Ana, DEMO-CAJA-1
    ('DEMO-MON-001', 'Efectivo',  45.50, 'Simple', 'Registrado', 'APROBADA',  'ana.demo@tallersis.bo',   'ana.demo@tallersis.bo',   'DEMO-CAJA-1', now() - interval '58 minutes'),
    ('DEMO-MON-002', 'QR',       120.00, 'Simple', 'Registrado', 'APROBADA',  'ana.demo@tallersis.bo',   'ana.demo@tallersis.bo',   'DEMO-CAJA-1', now() - interval '41 minutes'),
    ('DEMO-MON-003', 'Tarjeta',   80.00, 'Simple', 'Anulado',    'APROBADA',  'ana.demo@tallersis.bo',   'ana.demo@tallersis.bo',   'DEMO-CAJA-1', now() - interval '30 minutes'),
    ('DEMO-MON-004', 'Efectivo',  15.00, 'Simple', 'Registrado', 'APROBADA',  'ana.demo@tallersis.bo',   'ana.demo@tallersis.bo',   'DEMO-CAJA-1', now() - interval '6 minutes'),
    -- Bruno, DEMO-CAJA-1 (otro turno en la misma caja)
    ('DEMO-MON-005', 'Tarjeta',  250.00, 'Simple', 'Registrado', 'APROBADA',  'bruno.demo@tallersis.bo', 'bruno.demo@tallersis.bo', 'DEMO-CAJA-1', now() - interval '25 minutes'),
    ('DEMO-MON-006', 'QR',        60.00, 'Simple', 'Registrado', 'RECHAZADA', 'bruno.demo@tallersis.bo', 'bruno.demo@tallersis.bo', 'DEMO-CAJA-1', now() - interval '12 minutes'),
    ('DEMO-MON-007', 'Efectivo',  32.00, 'Simple', 'Registrado', 'APROBADA',  'bruno.demo@tallersis.bo', 'bruno.demo@tallersis.bo', 'DEMO-CAJA-1', now() - interval '3 minutes'),
    -- Carla, DEMO-CAJA-2
    ('DEMO-MON-008', 'Efectivo', 300.00, 'Simple', 'Registrado', 'APROBADA',  'carla.demo@tallersis.bo', 'carla.demo@tallersis.bo', 'DEMO-CAJA-2', now() - interval '50 minutes'),
    ('DEMO-MON-009', 'QR',        18.90, 'Simple', 'Registrado', 'APROBADA',  'carla.demo@tallersis.bo', 'carla.demo@tallersis.bo', 'DEMO-CAJA-2', now() - interval '1 minute');