-- ==========================================================================
-- TDSI-34/145: semilla para probar el monitoreo por metodo de pago.
-- SOLO para desarrollo / demo. Ejecutar despues de script_pagos.sql
-- (necesita la migracion 002).
--
-- Crea 11 ventas de los ultimos 3 dias (hace 1 a hace 3 dias, a horas fijas,
-- hora de Bolivia) de 2 cajeros de demostracion:
--   karen.demo@tallersis.bo  caja DEMO-MET-CAJA-1
--   luis.demo@tallersis.bo   caja DEMO-MET-CAJA-2
-- 6 pagos simples y 5 pagos mixtos (cabecera + detalle + una fila por metodo):
--   - 3 mixtos Efectivo + QR, 1 Efectivo + Tarjeta
--   - 1 mixto "antiguo" con la caja solo en la cabecera (sus filas sin caja_id)
--   - 1 mixto ANULADO y 1 simple RECHAZADO (no suman en ningun metodo)
-- Totales esperados (desde hace 3 dias hasta ayer):
--   DEMO-MET-CAJA-1: 4 ventas, 499.90 | Efectivo 200.00 | Tarjeta 249.90 | QR  50.00
--   DEMO-MET-CAJA-2: 5 ventas, 515.00 | Efectivo 119.50 | Tarjeta 240.00 | QR 155.50
--   Las dos cajas:   9 ventas, 1014.90 | Efectivo 319.50 | Tarjeta 489.90 | QR 205.50
--
-- Se puede volver a correr: borra la semilla anterior y la crea de nuevo.
-- Para QUITAR la semilla (detalles_pago se borra en cascada con pagos_mixtos):
--   DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MET-%';
--   DELETE FROM pagos.pagos_mixtos  WHERE id_transaccion LIKE 'DEMO-MET-%';
-- ==========================================================================

DELETE FROM pagos.transacciones WHERE id_transaccion LIKE 'DEMO-MET-%';
DELETE FROM pagos.pagos_mixtos  WHERE id_transaccion LIKE 'DEMO-MET-%';

-- Cabeceras de los pagos mixtos
INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, total, estado, fecha)
SELECT v.id_transaccion, v.caja_id, v.total, v.estado,
       (((now() AT TIME ZONE 'America/La_Paz')::date - v.dias_atras) + v.hora)::timestamp AT TIME ZONE 'America/La_Paz'
  FROM (VALUES
    ('DEMO-MET-003', 'DEMO-MET-CAJA-1', 100.00, 'Registrado', 3, time '13:00'),
    ('DEMO-MET-005', 'DEMO-MET-CAJA-1', 180.00, 'Registrado', 2, time '12:40'),
    ('DEMO-MET-006', 'DEMO-MET-CAJA-2',  60.00, 'Registrado', 2, time '16:20'),
    ('DEMO-MET-009', 'DEMO-MET-CAJA-1', 100.00, 'Anulado',    1, time '10:30'),
    ('DEMO-MET-010', 'DEMO-MET-CAJA-2',  65.50, 'Registrado', 1, time '14:10')
  ) AS v(id_transaccion, caja_id, total, estado, dias_atras, hora);

-- Ventas: una fila por metodo (los mixtos con pago_mixto_id a su cabecera)
INSERT INTO pagos.transacciones
    (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id, estado, estado_pago, cajero, cajero_id, caja_id, fecha)
SELECT v.id_transaccion, v.metodo, v.monto, v.tipo_pago,
       (SELECT id FROM pagos.pagos_mixtos WHERE id_transaccion = v.id_transaccion),
       v.estado, v.estado_pago, v.cajero, v.cajero, v.caja_id,
       (((now() AT TIME ZONE 'America/La_Paz')::date - v.dias_atras) + v.hora)::timestamp AT TIME ZONE 'America/La_Paz'
  FROM (VALUES
    ('DEMO-MET-001', 'Efectivo', 120.00, 'Simple', 'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 3, time '10:00'),
    ('DEMO-MET-002', 'QR',        85.00, 'Simple', 'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  'DEMO-MET-CAJA-2', 3, time '11:30'),
    ('DEMO-MET-003', 'Efectivo',  50.00, 'Mixto',  'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 3, time '13:00'),
    ('DEMO-MET-003', 'QR',        50.00, 'Mixto',  'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 3, time '13:00'),
    ('DEMO-MET-004', 'Tarjeta',  240.00, 'Simple', 'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  'DEMO-MET-CAJA-2', 2, time '09:15'),
    ('DEMO-MET-005', 'Tarjeta',  150.00, 'Mixto',  'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 2, time '12:40'),
    ('DEMO-MET-005', 'Efectivo',  30.00, 'Mixto',  'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 2, time '12:40'),
    -- mixto "antiguo": la caja solo esta en la cabecera
    ('DEMO-MET-006', 'QR',        45.00, 'Mixto',  'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  NULL,              2, time '16:20'),
    ('DEMO-MET-006', 'Efectivo',  15.00, 'Mixto',  'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  NULL,              2, time '16:20'),
    ('DEMO-MET-007', 'QR',        35.00, 'Simple', 'Registrado', 'RECHAZADA', 'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 2, time '17:00'),
    ('DEMO-MET-008', 'Efectivo',  64.50, 'Simple', 'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  'DEMO-MET-CAJA-2', 1, time '08:50'),
    ('DEMO-MET-009', 'Efectivo',  20.00, 'Mixto',  'Anulado',    'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 1, time '10:30'),
    ('DEMO-MET-009', 'Tarjeta',   80.00, 'Mixto',  'Anulado',    'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 1, time '10:30'),
    ('DEMO-MET-010', 'Efectivo',  40.00, 'Mixto',  'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  'DEMO-MET-CAJA-2', 1, time '14:10'),
    ('DEMO-MET-010', 'QR',        25.50, 'Mixto',  'Registrado', 'APROBADA',  'luis.demo@tallersis.bo',  'DEMO-MET-CAJA-2', 1, time '14:10'),
    ('DEMO-MET-011', 'Tarjeta',   99.90, 'Simple', 'Registrado', 'APROBADA',  'karen.demo@tallersis.bo', 'DEMO-MET-CAJA-1', 1, time '18:05')
  ) AS v(id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero, caja_id, dias_atras, hora);

-- Detalle de cada pago mixto (lo que muestra GET /api/pagos/mixto/:id_transaccion)
INSERT INTO pagos.detalles_pago (pago_id, metodo, monto, porcentaje, orden)
SELECT pm.id, t.metodo, t.monto, ROUND(100 * t.monto / pm.total, 2),
       ROW_NUMBER() OVER (PARTITION BY pm.id ORDER BY t.id)
  FROM pagos.pagos_mixtos pm
  JOIN pagos.transacciones t ON t.pago_mixto_id = pm.id
 WHERE pm.id_transaccion LIKE 'DEMO-MET-%';