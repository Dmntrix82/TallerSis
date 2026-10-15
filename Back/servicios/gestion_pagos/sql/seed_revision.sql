-- ==========================================================================
-- TDSI-27/430: semilla para probar la revision de transacciones por cajero.
-- SOLO para desarrollo / demo. Ejecutar despues de script_pagos.sql
-- (necesita las migraciones 002 y 003).
--
-- Crea ventas de 2 cajeros de demostracion en la caja DEMO-CAJA-3:
--   diego.demo@tallersis.bo  hoy: 6 ventas (Efectivo, QR, Tarjeta, una mixta
--                                 Efectivo+QR, una anulada y una rechazada)
--                            ayer: 2 ventas | hace 2 dias: 1 venta
--   elena.demo@tallersis.bo  hoy: 2 ventas
-- y 3 revisiones del supervisor.demo (2 REVISADAS y 1 OBSERVADA con nota).
-- Las fechas son relativas al dia en que se corre (hora de Bolivia): las de
-- hoy quedan unos minutos antes de ahora, las de dias anteriores a horas fijas.
--
-- Se puede volver a correr: borra la semilla anterior y la crea de nuevo.
-- Para QUITAR la semilla:
--   DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-REV-%';
--   DELETE FROM pagos.transacciones          WHERE id_transaccion LIKE 'DEMO-REV-%';
--   DELETE FROM pagos.pagos_mixtos           WHERE id_transaccion LIKE 'DEMO-REV-%';
-- ==========================================================================

DELETE FROM pagos.revisiones_transaccion WHERE id_transaccion LIKE 'DEMO-REV-%';
DELETE FROM pagos.transacciones          WHERE id_transaccion LIKE 'DEMO-REV-%';
DELETE FROM pagos.pagos_mixtos           WHERE id_transaccion LIKE 'DEMO-REV-%';

-- Dia de hoy: unos minutos antes de ahora. GREATEST asegura que, aunque se corra
-- apenas pasada la medianoche, las ventas igual queden en el dia de hoy (en el mismo orden).
INSERT INTO pagos.pagos_mixtos (id_transaccion, caja_id, total, fecha)
SELECT 'DEMO-REV-004', 'DEMO-CAJA-3', 100.00,
       GREATEST(now() - interval '20 minutes',
                ((now() AT TIME ZONE 'America/La_Paz')::date)::timestamp AT TIME ZONE 'America/La_Paz' + interval '40 seconds');

INSERT INTO pagos.transacciones
    (id_transaccion, metodo, monto, tipo_pago, pago_mixto_id, estado, estado_pago, cajero, cajero_id, caja_id, fecha)
SELECT v.id_transaccion, v.metodo, v.monto, v.tipo_pago,
       CASE WHEN v.tipo_pago = 'Mixto' THEN (SELECT id FROM pagos.pagos_mixtos WHERE id_transaccion = v.id_transaccion) END,
       v.estado, v.estado_pago, v.cajero, v.cajero, 'DEMO-CAJA-3',
       GREATEST(now() - make_interval(mins => v.minutos_antes),
                ((now() AT TIME ZONE 'America/La_Paz')::date)::timestamp AT TIME ZONE 'America/La_Paz'
                  + make_interval(secs => 60 - v.minutos_antes))
  FROM (VALUES
    ('DEMO-REV-001', 'Efectivo',  25.00, 'Simple', 'Registrado', 'APROBADA',  'diego.demo@tallersis.bo', 50),
    ('DEMO-REV-002', 'QR',        40.00, 'Simple', 'Registrado', 'APROBADA',  'diego.demo@tallersis.bo', 40),
    ('DEMO-REV-003', 'Tarjeta',  120.00, 'Simple', 'Registrado', 'APROBADA',  'diego.demo@tallersis.bo', 30),
    ('DEMO-REV-004', 'Efectivo',  30.00, 'Mixto',  'Registrado', 'APROBADA',  'diego.demo@tallersis.bo', 20),
    ('DEMO-REV-004', 'QR',        70.00, 'Mixto',  'Registrado', 'APROBADA',  'diego.demo@tallersis.bo', 20),
    ('DEMO-REV-005', 'Tarjeta',   55.00, 'Simple', 'Anulado',    'APROBADA',  'diego.demo@tallersis.bo', 12),
    ('DEMO-REV-006', 'QR',        15.00, 'Simple', 'Registrado', 'RECHAZADA', 'diego.demo@tallersis.bo',  5),
    ('DEMO-REV-010', 'Efectivo',  18.00, 'Simple', 'Registrado', 'APROBADA',  'elena.demo@tallersis.bo', 45),
    ('DEMO-REV-011', 'QR',        64.00, 'Simple', 'Registrado', 'APROBADA',  'elena.demo@tallersis.bo', 15)
  ) AS v(id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero, minutos_antes);

-- Dias anteriores (hora de Bolivia): ayer y hace 2 dias
INSERT INTO pagos.transacciones
    (id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero, cajero_id, caja_id, fecha)
VALUES
    ('DEMO-REV-007', 'Efectivo',  80.00, 'Simple', 'Registrado', 'APROBADA', 'diego.demo@tallersis.bo', 'diego.demo@tallersis.bo', 'DEMO-CAJA-3',
        (((now() AT TIME ZONE 'America/La_Paz')::date - 1) + time '10:30')::timestamp AT TIME ZONE 'America/La_Paz'),
    ('DEMO-REV-008', 'QR',        22.50, 'Simple', 'Registrado', 'APROBADA', 'diego.demo@tallersis.bo', 'diego.demo@tallersis.bo', 'DEMO-CAJA-3',
        (((now() AT TIME ZONE 'America/La_Paz')::date - 1) + time '16:45')::timestamp AT TIME ZONE 'America/La_Paz'),
    ('DEMO-REV-009', 'Tarjeta',  300.00, 'Simple', 'Registrado', 'APROBADA', 'diego.demo@tallersis.bo', 'diego.demo@tallersis.bo', 'DEMO-CAJA-3',
        (((now() AT TIME ZONE 'America/La_Paz')::date - 2) + time '11:00')::timestamp AT TIME ZONE 'America/La_Paz');

-- Revisiones del supervisor de demostracion
INSERT INTO pagos.revisiones_transaccion (id_transaccion, estado, nota, revisado_por, revisado_en)
VALUES
    ('DEMO-REV-001', 'REVISADA',  NULL,                           'supervisor.demo', now() - interval '10 minutes'),
    ('DEMO-REV-003', 'OBSERVADA', 'Voucher de tarjeta sin firma', 'supervisor.demo', now() - interval '8 minutes'),
    ('DEMO-REV-007', 'REVISADA',  'Cuadra con el arqueo',         'supervisor.demo', now() - interval '1 day');