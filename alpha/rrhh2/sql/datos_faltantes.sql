USE fayxzvov_rrhh;

-- IDs reales: 1=Carlos, 2=Maria, 3=Juan, 4=Ana, 5=Pedro, 6=Laura,
-- 14=Sofia, 15=Roberto, 16=Diana, 17=Fernando, 18=Gabriela,
-- 19=Miguel, 20=Valeria, 21=Ricardo, 22=Isabel

-- PERMISOS ADICIONALES
INSERT INTO rrhh_permisos
(codigo, empleado_id, tipo, fecha_inicio, fecha_fin, dias, razon, estatus, solicitado_por)
VALUES
('PC-0004', 2,  'incapacidad', '2026-04-07', '2026-04-09', 3, 'Consulta medica programada', 'aprobado', 1),
('PC-0005', 3,  'permiso',     '2026-04-11', '2026-04-11', 1, 'Tramite personal urgente', 'pendiente', 1),
('PC-0006', 4,  'vacaciones',  '2026-04-21', '2026-04-25', 5, 'Vacaciones familiares', 'pendiente', 1),
('PC-0007', 5,  'permiso',     '2026-04-03', '2026-04-03', 1, 'Cita con abogado', 'aprobado', 1),
('PC-0008', 6,  'incapacidad', '2026-03-25', '2026-03-28', 4, 'Cirugia dental', 'aprobado', 1),
('PC-0009', 14, 'vacaciones',  '2026-05-01', '2026-05-05', 5, 'Viaje familiar', 'pendiente', 1),
('PC-0010', 15, 'permiso',     '2026-04-08', '2026-04-08', 1, 'Asunto familiar', 'rechazado', 1),
('PC-0011', 17, 'vacaciones',  '2026-04-14', '2026-04-18', 5, 'Descanso programado', 'pendiente', 1);

-- INCIDENCIAS (abril 2026)
INSERT INTO rrhh_incidencias
(empleado_id, fecha, tipo_ingreso, hora_entrada, hora_salida, estatus, minutos_tarde, observaciones, subsidiaries_id)
VALUES
-- 2026-04-01
(1,  '2026-04-01', 'manual', '06:55:00', '15:05:00', 'atiempo',  0,  NULL, 1),
(2,  '2026-04-01', 'manual', '07:02:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(3,  '2026-04-01', 'manual', '15:10:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6,  '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(14, '2026-04-01', 'manual', '06:58:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(15, '2026-04-01', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(16, '2026-04-01', 'manual', '07:05:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(21, '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4,  '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5,  '2026-04-01', 'manual', '15:05:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(17, '2026-04-01', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(18, '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
-- 2026-04-02
(1,  '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(2,  '2026-04-02', 'manual', '07:15:00', '15:00:00', 'retardo',  15, 'Llego tarde por trafico', 1),
(3,  '2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6,  '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(14, '2026-04-02', 'manual', NULL,       NULL,       'falta',     0,  'No se presento', 1),
(15, '2026-04-02', 'manual', '15:20:00', '23:00:00', 'retardo',  20, NULL, 1),
(16, '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4,  '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5,  '2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(17, '2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(18, '2026-04-02', 'manual', '07:12:00', '15:00:00', 'retardo',  12, NULL, 2),
-- 2026-04-03
(1,  '2026-04-03', 'manual', '06:50:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(2,  '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(3,  '2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6,  '2026-04-03', 'manual', NULL,       NULL,       'falta',     0,  'Ausencia sin justificar', 1),
(14, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(15, '2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(16, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4,  '2026-04-03', 'manual', '07:05:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5,  '2026-04-03', 'manual', NULL,       NULL,       'falta',     0,  'Permiso aprobado', 2),
(17, '2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(18, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
-- 2026-04-07
(1,  '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2,  '2026-04-07', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica', 1),
(3,  '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(6,  '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(14, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(15, '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(16, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(4,  '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
(5,  '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(17, '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(18, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
-- 2026-04-08
(1,  '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2,  '2026-04-08', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica', 1),
(3,  '2026-04-08', 'manual', '15:25:00', '23:00:00', 'retardo',     25, 'Problema de transporte', 1),
(6,  '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(14, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(16, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(4,  '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
(5,  '2026-04-08', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(17, '2026-04-08', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
-- 2026-04-09
(1,  '2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2,  '2026-04-09', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica (ultimo dia)', 1),
(3,  '2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(6,  '2026-04-09', 'manual', '07:05:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(14, '2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(16, '2026-04-09', 'manual', NULL,       NULL,       'falta',       0,  'No se presento', 1),
(4,  '2026-04-09', 'manual', '07:18:00', '15:00:00', 'retardo',     18, NULL, 2),
(5,  '2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(17, '2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(18, '2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
-- 2026-04-10 (hoy)
(1,  '2026-04-10', 'manual', '06:55:00', NULL,       'atiempo',     0,  NULL, 1),
(2,  '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(3,  '2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 1),
(6,  '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(14, '2026-04-10', 'manual', '07:30:00', NULL,       'retardo',     30, 'Llego muy tarde', 1),
(16, '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(4,  '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 2),
(5,  '2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 2),
(17, '2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 2),
(18, '2026-04-10', 'manual', '07:05:00', NULL,       'atiempo',     0,  NULL, 2);

-- NOMINA DETALLE para periodos 2 y 4
INSERT INTO rrhh_nomina_detalle
(periodo_id, empleado_id, dias_laborados, dias_faltas, dias_vacaciones, dias_incapacidad, sueldo_diario, salario_total, faltas_retardos_descuento, bonos, descuentos, a_pagar_efectivo, a_pagar_bancos, total_nomina)
VALUES
(2, 1,  15, 0, 0, 0, 500.00, 7500.00, 0,     200.00, 0, 0, 7700.00, 7700.00),
(2, 2,  14, 1, 0, 0, 280.00, 3920.00, 280.00, 0,     0, 0, 3640.00, 3640.00),
(2, 3,  15, 0, 0, 0, 240.00, 3600.00, 0,      0,     0, 0, 3600.00, 3600.00),
(2, 6,  15, 0, 0, 0, 450.00, 6750.00, 0,     300.00,  0, 0, 7050.00, 7050.00),
(2, 14, 13, 2, 0, 0, 260.00, 3380.00, 520.00, 0,     0, 0, 2860.00, 2860.00),
(2, 15, 15, 0, 0, 0, 240.00, 3600.00, 0,      0,     0, 0, 3600.00, 3600.00),
(2, 16, 15, 0, 0, 0, 220.00, 3300.00, 0,      0,     0, 0, 3300.00, 3300.00),
(2, 21, 15, 0, 0, 0, 230.00, 3450.00, 0,      0,     0, 0, 3450.00, 3450.00),
(4, 4,  15, 0, 0, 0, 260.00, 3900.00, 0,      0,     0, 0, 3900.00, 3900.00),
(4, 5,  14, 1, 0, 0, 230.00, 3220.00, 230.00, 0,     0, 0, 2990.00, 2990.00),
(4, 17, 15, 0, 0, 0, 280.00, 4200.00, 0,      0,     0, 0, 4200.00, 4200.00),
(4, 18, 15, 0, 0, 0, 240.00, 3600.00, 0,      0,     0, 0, 3600.00, 3600.00);

UPDATE rrhh_nomina_periodos SET total_general = 35200.00, total_bancos = 35200.00, total_colaboradores = 8 WHERE id = 2;
UPDATE rrhh_nomina_periodos SET total_general = 14690.00, total_bancos = 14690.00, total_colaboradores = 4 WHERE id = 4;

SELECT 'Datos insertados correctamente' AS resultado;
