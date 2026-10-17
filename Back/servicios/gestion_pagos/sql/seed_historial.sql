-- ==========================================================================
-- TDSI-33/143: semilla para probar el historial de operaciones de cajeros.
-- SOLO para desarrollo / demo. Ejecutar despues de script_pagos.sql
-- (necesita las migraciones 002 y 003).
--
-- Crea 14 operaciones de los ultimos 6 dias (hace 1 a hace 6 dias, a horas
-- fijas, hora de Bolivia), asi salen en el historial por defecto (ultimos 7 dias):
--   hugo.demo@tallersis.bo   caja DEMO-HIST-CAJA-1: 5 operaciones (1 anulada)
--   ines.demo@tallersis.bo   caja DEMO-HIST-CAJA-2: 5 operaciones (1 mixta Efectivo+Tarjeta, 1 rechazada)
--   jorge.demo@tallersis.bo  cajas 1 y 2:           4 operaciones
-- y 5 revisiones del supervisor.demo (3 REVISADAS y 2 OBSERVADAS con nota).
-- Totales esperados (solo APROBADAS): hugo 262.00 | ines 150.50 | jorge 393.40 | general 805.90
--
-- Se puede volver a correr: borra la semilla anterior y la crea de nuevo.
-- Para QUITAR la semilla:
--   DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-HIST-%';
--   DELETE FROM pagos.transacciones          WHERE id_transaccion LIKE 'DEMO-HIST-%';
--   DELETE FROM pagos.pagos_mixtos           WHERE id_transaccion LIKE 'DEMO-HIST-%';
-- ==========================================================================

DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-HIST-%';
DELETE FROM pagos.transacciones          WHERE id_transaccion LIKE 'DEMO-HIST-%';
DELETE FROM pagos.pagos_mixtos           WHERE id_transaccion LIKE 'DEMO-HIST-%';

-- Cabecera del pago mixto (hace 4 dias, 12:30)
INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, total, fecha)
VALUES ('DEMO-HIST-005', 'DEMO-HIST-CAJA-2', 80.00,
        (((now() AT TIME ZONE 'America/La_Paz')::date - 4) + time '12:30')::timestamp AT TIME ZONE 'America/La_Paz');

INSERT INTO pagos.transacciones
    (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id, estado, estado_pago, cajero, cajero_id, caja_id, fecha)
SELECT v.id_transaccion, v.metodo, v.monto, v.tipo_pago,
       CASE WHEN v.tipo_pago = 'Mixto' THEN (SELECT id FROM pagos.pagos_mixtos WHERE id_transaccion = v.id_transaccion) END,
       v.estado, v.estado_pago, v.cajero, v.cajero, v.caja_id,
       (((now() AT TIME ZONE 'America/La_Paz')::date - v.dias_atras) + v.hora)::timestamp AT TIME ZONE 'America/La_Paz'
  FROM (VALUES
    ('DEMO-HIST-001', 'Efectivo',  45.00, 'Simple', 'Registrado', 'APROBADA',  'hugo.demo@tallersis.bo',  'DEMO-HIST-CAJA-1', 6, time '09:15'),
    ('DEMO-HIST-002', 'QR',        32.00, 'Simple', 'Registrado', 'APROBADA',  'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 6, time '10:40'),
    ('DEMO-HIST-003', 'Tarjeta',  150.00, 'Simple', 'Registrado', 'APROBADA',  'hugo.demo@tallersis.bo',  'DEMO-HIST-CAJA-1', 5, time '11:20'),
    ('DEMO-HIST-004', 'Efectivo',  18.50, 'Simple', 'Registrado', 'APROBADA',  'jorge.demo@tallersis.bo', 'DEMO-HIST-CAJA-2', 5, time '15:05'),
    ('DEMO-HIST-005', 'Efectivo',  20.00, 'Mixto',  'Registrado', 'APROBADA',  'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 4, time '12:30'),
    ('DEMO-HIST-005', 'Tarjeta',   60.00, 'Mixto',  'Registrado', 'APROBADA',  'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 4, time '12:30'),
    ('DEMO-HIST-006', 'QR',        27.00, 'Simple', 'Anulado',    'APROBADA',  'hugo.demo@tallersis.bo',  'DEMO-HIST-CAJA-1', 4, time '17:50'),
    ('DEMO-HIST-007', 'Tarjeta',  210.00, 'Simple', 'Registrado', 'APROBADA',  'jorge.demo@tallersis.bo', 'DEMO-HIST-CAJA-2', 3, time '09:05'),
    ('DEMO-HIST-008', 'Efectivo',  12.00, 'Simple', 'Registrado', 'APROBADA',  'hugo.demo@tallersis.bo',  'DEMO-HIST-CAJA-1', 3, time '13:35'),
    ('DEMO-HIST-009', 'QR',        40.00, 'Simple', 'Registrado', 'RECHAZADA', 'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 3, time '16:10'),
    ('DEMO-HIST-010', 'QR',        65.00, 'Simple', 'Registrado', 'APROBADA',  'jorge.demo@tallersis.bo', 'DEMO-HIST-CAJA-1', 2, time '10:00'),
    ('DEMO-HIST-011', 'Efectivo',  23.00, 'Simple', 'Registrado', 'APROBADA',  'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 2, time '14:25'),
    ('DEMO-HIST-012', 'Efectivo',  55.00, 'Simple', 'Registrado', 'APROBADA',  'hugo.demo@tallersis.bo',  'DEMO-HIST-CAJA-1', 1, time '08:45'),
    ('DEMO-HIST-013', 'Tarjeta',   99.90, 'Simple', 'Registrado', 'APROBADA',  'jorge.demo@tallersis.bo', 'DEMO-HIST-CAJA-2', 1, time '12:15'),
    ('DEMO-HIST-014', 'QR',        15.50, 'Simple', 'Registrado', 'APROBADA',  'ines.demo@tallersis.bo',  'DEMO-HIST-CAJA-2', 1, time '18:30')
  ) AS v(id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero, caja_id, dias_atras, hora);

-- Revisiones del supervisor de demostracion
INSERT INTO pagos.revisiones_transaccion (id_transaccion, estado, nota, revisado_por, revisado_en)
VALUES
    ('DEMO-HIST-001', 'REVISADA',  NULL,                          'supervisor.demo', now() - interval '6 days'),
    ('DEMO-HIST-003', 'OBSERVADA', 'Voucher de tarjeta ilegible', 'supervisor.demo', now() - interval '5 days'),
    ('DEMO-HIST-007', 'REVISADA',  'Cuadra con el arqueo',        'supervisor.demo', now() - interval '3 days'),
    ('DEMO-HIST-010', 'OBSERVADA', 'Pago QR sin comprobante',     'supervisor.demo', now() - interval '2 days'),
    ('DEMO-HIST-012', 'REVISADA',  NULL,                          'supervisor.demo', now() - interval '1 day');