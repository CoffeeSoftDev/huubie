-- =============================================
-- DATOS DE PRUEBA - RRHH Module
-- Ejecutar en phpMyAdmin
-- =============================================

USE fayxzvov_rrhh;

-- =============================================
-- EMPLEADOS ADICIONALES (ya existen 6, agregamos 9 mas)
-- =============================================

INSERT INTO rrhh_empleados
(codigo_empleado, nombre, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento, puesto_id, turno_id, subsidiaries_id, companies_id, tipo_contrato, fecha_ingreso, salario_diario, frecuencia_pago, estado, created_by)
VALUES
('EMP-0007', 'Sofia',    'Martinez',  'Luna',     'sofia@test.com',    '9621001007', '1995-03-12', 4, 1, 1, 1, 'indefinido', '2025-08-15', 260.00, 'quincenal', 'activo', 1),
('EMP-0008', 'Roberto',  'Hernandez', 'Diaz',     'roberto@test.com',  '9621001008', '1990-07-22', 5, 2, 1, 1, 'indefinido', '2025-06-01', 240.00, 'quincenal', 'activo', 1),
('EMP-0009', 'Diana',    'Cruz',      'Ramos',    'diana@test.com',    '9621001009', '1998-11-05', 7, 1, 1, 1, 'temporal',   '2026-01-10', 220.00, 'semanal',   'activo', 1),
('EMP-0010', 'Fernando', 'Ruiz',      'Morales',  'fernando@test.com', '9621001010', '1992-04-18', 3, 2, 2, 2, 'indefinido', '2025-09-20', 280.00, 'quincenal', 'activo', 1),
('EMP-0011', 'Gabriela', 'Flores',    'Ortiz',    'gabriela@test.com', '9621001011', '1996-01-30', 5, 1, 2, 2, 'indefinido', '2025-10-05', 240.00, 'quincenal', 'activo', 1),
('EMP-0012', 'Miguel',   'Torres',    'Castillo', 'miguel@test.com',   '9621001012', '1988-09-14', 2, 1, 4, 4, 'indefinido', '2025-05-15', 450.00, 'quincenal', 'activo', 1),
('EMP-0013', 'Valeria',  'Sanchez',   'Reyes',    'valeria@test.com',  '9621001013', '1997-06-25', 4, 2, 4, 4, 'indefinido', '2025-11-01', 260.00, 'quincenal', 'activo', 1),
('EMP-0014', 'Ricardo',  'Moreno',    NULL,       'ricardo@test.com',  '9621001014', '1993-12-08', 6, 1, 1, 1, 'temporal',   '2026-02-01', 230.00, 'semanal',   'suspendido', 1),
('EMP-0015', 'Isabel',   'Vargas',    'Soto',     'isabel@test.com',   '9621001015', '1994-08-19', 3, 1, 2, 2, 'indefinido', '2025-07-10', 280.00, 'quincenal', 'baja', 1);

-- Actualizar baja de Isabel
UPDATE rrhh_empleados SET fecha_baja = '2026-03-15', motivo_baja = 'Renuncia voluntaria' WHERE codigo_empleado = 'EMP-0015';

-- =============================================
-- PERMISOS ADICIONALES (ya existen 3, agregamos mas variados)
-- =============================================

INSERT INTO rrhh_permisos
(codigo, empleado_id, tipo, fecha_inicio, fecha_fin, dias, razon, estatus, solicitado_por)
VALUES
('PC-0004', 2, 'incapacidad', '2026-04-07', '2026-04-09', 3, 'Consulta medica programada', 'aprobado', 1),
('PC-0005', 3, 'permiso',     '2026-04-11', '2026-04-11', 1, 'Tramite personal urgente', 'pendiente', 1),
('PC-0006', 4, 'vacaciones',  '2026-04-21', '2026-04-25', 5, 'Vacaciones familiares', 'pendiente', 1),
('PC-0007', 5, 'permiso',     '2026-04-03', '2026-04-03', 1, 'Cita con abogado', 'aprobado', 1),
('PC-0008', 6, 'incapacidad', '2026-03-25', '2026-03-28', 4, 'Cirugia dental', 'aprobado', 1),
('PC-0009', 7, 'vacaciones',  '2026-05-01', '2026-05-05', 5, 'Viaje familiar', 'pendiente', 1),
('PC-0010', 8, 'permiso',     '2026-04-08', '2026-04-08', 1, 'Asunto familiar', 'rechazado', 1),
('PC-0011', 10, 'vacaciones', '2026-04-14', '2026-04-18', 5, 'Descanso programado', 'pendiente', 1);

-- =============================================
-- INCIDENCIAS (abril 2026 - ultimos 10 dias)
-- =============================================

INSERT INTO rrhh_incidencias
(empleado_id, fecha, tipo_ingreso, hora_entrada, hora_salida, estatus, minutos_tarde, observaciones, subsidiaries_id)
VALUES
-- 2026-04-01
(1, '2026-04-01', 'manual', '06:55:00', '15:05:00', 'atiempo',  0,  NULL, 1),
(2, '2026-04-01', 'manual', '07:02:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(3, '2026-04-01', 'manual', '15:10:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6, '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(7, '2026-04-01', 'manual', '06:58:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(8, '2026-04-01', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(9, '2026-04-01', 'manual', '07:05:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(14,'2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4, '2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5, '2026-04-01', 'manual', '15:05:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(10,'2026-04-01', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(11,'2026-04-01', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),

-- 2026-04-02
(1, '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(2, '2026-04-02', 'manual', '07:15:00', '15:00:00', 'retardo',  15, 'Llego tarde por trafico', 1),
(3, '2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6, '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(7, '2026-04-02', 'manual', NULL,       NULL,       'falta',     0,  'No se presento', 1),
(8, '2026-04-02', 'manual', '15:20:00', '23:00:00', 'retardo',  20, NULL, 1),
(9, '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4, '2026-04-02', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5, '2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(10,'2026-04-02', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(11,'2026-04-02', 'manual', '07:12:00', '15:00:00', 'retardo',  12, NULL, 2),

-- 2026-04-03
(1, '2026-04-03', 'manual', '06:50:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(2, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(3, '2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(6, '2026-04-03', 'manual', NULL,       NULL,       'falta',     0,  'Ausencia sin justificar', 1),
(7, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(8, '2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 1),
(9, '2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 1),
(4, '2026-04-03', 'manual', '07:05:00', '15:00:00', 'atiempo',  0,  NULL, 2),
(5, '2026-04-03', 'manual', NULL,       NULL,       'falta',     0,  'Permiso aprobado', 2),
(10,'2026-04-03', 'manual', '15:00:00', '23:00:00', 'atiempo',  0,  NULL, 2),
(11,'2026-04-03', 'manual', '07:00:00', '15:00:00', 'atiempo',  0,  NULL, 2),

-- 2026-04-07 (lunes)
(1, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2, '2026-04-07', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica', 1),
(3, '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(6, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(7, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(8, '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(9, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(4, '2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
(5, '2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(10,'2026-04-07', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(11,'2026-04-07', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),

-- 2026-04-08
(1, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2, '2026-04-08', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica', 1),
(3, '2026-04-08', 'manual', '15:25:00', '23:00:00', 'retardo',     25, 'Problema de transporte', 1),
(6, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(7, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(9, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(4, '2026-04-08', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),
(5, '2026-04-08', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(10,'2026-04-08', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),

-- 2026-04-09
(1, '2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(2, '2026-04-09', 'manual', NULL,       NULL,       'incapacidad', 0,  'Incapacidad medica (ultimo dia)', 1),
(3, '2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 1),
(6, '2026-04-09', 'manual', '07:05:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(7, '2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 1),
(9, '2026-04-09', 'manual', NULL,       NULL,       'falta',       0,  'No se presento', 1),
(4, '2026-04-09', 'manual', '07:18:00', '15:00:00', 'retardo',     18, NULL, 2),
(5, '2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(10,'2026-04-09', 'manual', '15:00:00', '23:00:00', 'atiempo',     0,  NULL, 2),
(11,'2026-04-09', 'manual', '07:00:00', '15:00:00', 'atiempo',     0,  NULL, 2),

-- 2026-04-10 (hoy)
(1, '2026-04-10', 'manual', '06:55:00', NULL,       'atiempo',     0,  NULL, 1),
(2, '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(3, '2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 1),
(6, '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(7, '2026-04-10', 'manual', '07:30:00', NULL,       'retardo',     30, 'Llego muy tarde', 1),
(9, '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 1),
(4, '2026-04-10', 'manual', '07:00:00', NULL,       'atiempo',     0,  NULL, 2),
(5, '2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 2),
(10,'2026-04-10', 'manual', NULL,       NULL,       'sin_estatus', 0,  NULL, 2),
(11,'2026-04-10', 'manual', '07:05:00', NULL,       'atiempo',     0,  NULL, 2);

-- =============================================
-- NOMINA - Periodo quincenal marzo
-- =============================================

INSERT INTO rrhh_nomina_periodos
(codigo, subsidiaries_id, companies_id, fecha_inicio, fecha_fin, frecuencia, estatus, total_efectivo, total_bancos, total_general, total_colaboradores, calculado_por, calculado_at)
VALUES
('NOM-20260316-1', 1, 1, '2026-03-16', '2026-03-31', 'quincenal', 'pagada',    0, 52800.00, 52800.00, 8, 1, '2026-04-01 10:00:00'),
('NOM-20260401-1', 1, 1, '2026-04-01', '2026-04-15', 'quincenal', 'calculada', 0, 0, 0, 8, 1, '2026-04-09 10:00:00'),
('NOM-20260316-2', 2, 2, '2026-03-16', '2026-03-31', 'quincenal', 'aprobada',  0, 30300.00, 30300.00, 4, 1, '2026-04-01 10:00:00');

-- Detalle nomina periodo 1 (Marinni Centro - marzo 2da quincena - pagada)
INSERT INTO rrhh_nomina_detalle
(periodo_id, empleado_id, dias_laborados, dias_faltas, dias_vacaciones, dias_incapacidad, sueldo_diario, salario_total, faltas_retardos_descuento, bonos, descuentos, a_pagar_efectivo, a_pagar_bancos, total_nomina)
VALUES
(1, 1,  15, 0, 0, 0, 500.00, 7500.00, 0,    200.00, 0, 0, 7700.00, 7700.00),
(1, 2,  14, 1, 0, 0, 280.00, 3920.00, 280.00, 0,    0, 0, 3640.00, 3640.00),
(1, 3,  15, 0, 0, 0, 240.00, 3600.00, 0,     0,     0, 0, 3600.00, 3600.00),
(1, 6,  15, 0, 0, 0, 450.00, 6750.00, 0,     300.00, 0, 0, 7050.00, 7050.00),
(1, 7,  13, 2, 0, 0, 260.00, 3380.00, 520.00, 0,    0, 0, 2860.00, 2860.00),
(1, 8,  15, 0, 0, 0, 240.00, 3600.00, 0,     0,     0, 0, 3600.00, 3600.00),
(1, 9,  15, 0, 0, 0, 220.00, 3300.00, 0,     0,     0, 0, 3300.00, 3300.00),
(1, 14, 15, 0, 0, 0, 230.00, 3450.00, 0,     0,     0, 0, 3450.00, 3450.00);

-- Actualizar totales periodo 1
UPDATE rrhh_nomina_periodos SET total_general = 35200.00, total_bancos = 35200.00 WHERE id = 1;

-- Detalle nomina periodo 3 (Club Campestre - marzo 2da quincena - aprobada)
INSERT INTO rrhh_nomina_detalle
(periodo_id, empleado_id, dias_laborados, dias_faltas, dias_vacaciones, dias_incapacidad, sueldo_diario, salario_total, faltas_retardos_descuento, bonos, descuentos, a_pagar_efectivo, a_pagar_bancos, total_nomina)
VALUES
(3, 4,  15, 0, 0, 0, 260.00, 3900.00, 0,     0, 0, 0, 3900.00, 3900.00),
(3, 5,  14, 1, 0, 0, 230.00, 3220.00, 230.00, 0, 0, 0, 2990.00, 2990.00),
(3, 10, 15, 0, 0, 0, 280.00, 4200.00, 0,     0, 0, 0, 4200.00, 4200.00),
(3, 11, 15, 0, 0, 0, 240.00, 3600.00, 0,     0, 0, 0, 3600.00, 3600.00);

-- Actualizar totales periodo 3
UPDATE rrhh_nomina_periodos SET total_general = 14690.00, total_bancos = 14690.00 WHERE id = 3;

SELECT 'Datos de prueba insertados correctamente' AS resultado;
