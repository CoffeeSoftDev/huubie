CREATE DATABASE IF NOT EXISTS `fayxzvov_rrhh`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `fayxzvov_rrhh`;

-- ============================================================
-- 0. SUCURSALES
-- ============================================================

CREATE TABLE IF NOT EXISTS `subsidiaries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) DEFAULT NULL,
  `companies_id` INT DEFAULT NULL,
  `enabled` INT DEFAULT '1',
  `logo` TEXT,
  `ubication` TEXT,
  `active` SMALLINT DEFAULT '0',
  `date_creation` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_subsidiaries_company` (`companies_id`),
  KEY `idx_subsidiaries_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 1. CATALOGOS
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_puestos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `descripcion` TEXT NULL,
  `color_badge` VARCHAR(20) DEFAULT 'gray',
  `icono` VARCHAR(50) NULL,
  `salario_base_sugerido` DECIMAL(10,2) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_puestos_nombre` (`nombre`),
  KEY `idx_rrhh_puestos_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rrhh_turnos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(40) NOT NULL,
  `hora_entrada` TIME NOT NULL,
  `hora_salida` TIME NOT NULL,
  `tolerancia_retardo_min` INT(3) NOT NULL DEFAULT 10,
  `duracion_horas` DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_turnos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. EMPLEADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_empleados` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usr_users_id` INT UNSIGNED NULL,
  `codigo_empleado` VARCHAR(20) NOT NULL,
  `nombre` VARCHAR(80) NOT NULL,
  `apellido_paterno` VARCHAR(80) NOT NULL,
  `apellido_materno` VARCHAR(80) NULL,
  `foto_url` VARCHAR(255) NULL,
  `email` VARCHAR(120) NULL,
  `telefono` VARCHAR(20) NULL,
  `fecha_nacimiento` DATE NULL,
  `curp` VARCHAR(18) NULL,
  `rfc` VARCHAR(13) NULL,
  `nss` VARCHAR(11) NULL,
  `cuenta_bancaria` VARCHAR(20) NULL,
  `banco` VARCHAR(40) NULL,
  `puesto_id` INT UNSIGNED NOT NULL,
  `turno_id` INT UNSIGNED NOT NULL,
  `subsidiaries_id` INT NOT NULL,
  `companies_id` INT UNSIGNED NOT NULL,
  `tipo_contrato` ENUM('indefinido','temporal','honorarios','eventual') NOT NULL DEFAULT 'indefinido',
  `fecha_ingreso` DATE NOT NULL,
  `fecha_baja` DATE NULL,
  `motivo_baja` TEXT NULL,
  `salario_diario` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `frecuencia_pago` ENUM('semanal','catorcenal','quincenal','mensual') NOT NULL DEFAULT 'quincenal',
  `estado` ENUM('activo','baja','suspendido') NOT NULL DEFAULT 'activo',
  `notas` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT UNSIGNED NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_empleados_codigo` (`codigo_empleado`),
  UNIQUE KEY `uk_rrhh_empleados_curp` (`curp`),
  UNIQUE KEY `uk_rrhh_empleados_rfc` (`rfc`),
  KEY `idx_rrhh_empleados_usr` (`usr_users_id`),
  KEY `idx_rrhh_empleados_puesto` (`puesto_id`),
  KEY `idx_rrhh_empleados_turno` (`turno_id`),
  KEY `idx_rrhh_empleados_sub` (`subsidiaries_id`),
  KEY `idx_rrhh_empleados_estado` (`estado`),
  KEY `idx_rrhh_empleados_ingreso` (`fecha_ingreso`),
  CONSTRAINT `fk_rrhh_empleados_puesto` FOREIGN KEY (`puesto_id`) REFERENCES `rrhh_puestos`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rrhh_empleados_turno` FOREIGN KEY (`turno_id`) REFERENCES `rrhh_turnos`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rrhh_empleados_sub` FOREIGN KEY (`subsidiaries_id`) REFERENCES `subsidiaries`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. PERMISOS
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_permisos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(20) NOT NULL,
  `empleado_id` INT UNSIGNED NOT NULL,
  `tipo` ENUM('incapacidad','vacaciones','permiso') NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `dias` INT(3) NOT NULL,
  `razon` TEXT NULL,
  `estatus` ENUM('pendiente','aprobado','rechazado','sin_estatus') NOT NULL DEFAULT 'pendiente',
  `solicitud_file` VARCHAR(255) NULL,
  `comprobante_file` VARCHAR(255) NULL,
  `solicitado_por` INT UNSIGNED NOT NULL,
  `aprobado_por` INT UNSIGNED NULL,
  `aprobado_at` DATETIME NULL,
  `rechazado_por` INT UNSIGNED NULL,
  `rechazado_at` DATETIME NULL,
  `observaciones_aprobador` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_permisos_codigo` (`codigo`),
  KEY `idx_rrhh_permisos_empleado` (`empleado_id`),
  KEY `idx_rrhh_permisos_tipo` (`tipo`),
  KEY `idx_rrhh_permisos_estatus` (`estatus`),
  KEY `idx_rrhh_permisos_fechas` (`fecha_inicio`, `fecha_fin`),
  CONSTRAINT `fk_rrhh_permisos_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `rrhh_empleados`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. INCIDENCIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_incidencias` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `empleado_id` INT UNSIGNED NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_ingreso` ENUM('manual','automatico','biometrico','importado') NOT NULL DEFAULT 'manual',
  `hora_entrada` TIME NULL,
  `hora_salida` TIME NULL,
  `estatus` ENUM('atiempo','retardo','falta','sin_estatus','vacaciones','incapacidad','reconocimiento') NOT NULL DEFAULT 'sin_estatus',
  `minutos_tarde` INT(4) NOT NULL DEFAULT 0,
  `observaciones` TEXT NULL,
  `registrado_por` INT UNSIGNED NULL,
  `permiso_id` INT UNSIGNED NULL,
  `subsidiaries_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_incidencias_emp_fecha` (`empleado_id`, `fecha`),
  KEY `idx_rrhh_incidencias_fecha` (`fecha`),
  KEY `idx_rrhh_incidencias_estatus` (`estatus`),
  KEY `idx_rrhh_incidencias_sub_fecha` (`subsidiaries_id`, `fecha`),
  KEY `idx_rrhh_incidencias_permiso` (`permiso_id`),
  CONSTRAINT `fk_rrhh_incidencias_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `rrhh_empleados`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rrhh_incidencias_permiso` FOREIGN KEY (`permiso_id`) REFERENCES `rrhh_permisos`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rrhh_incidencias_sub` FOREIGN KEY (`subsidiaries_id`) REFERENCES `subsidiaries`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. NOMINA
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_nomina_periodos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `subsidiaries_id` INT NOT NULL,
  `companies_id` INT UNSIGNED NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `frecuencia` ENUM('semanal','catorcenal','quincenal','mensual') NOT NULL,
  `estatus` ENUM('abierta','calculada','aprobada','pagada','cancelada') NOT NULL DEFAULT 'abierta',
  `total_efectivo` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_bancos` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_general` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_colaboradores` INT(5) NOT NULL DEFAULT 0,
  `calculado_por` INT UNSIGNED NULL,
  `calculado_at` DATETIME NULL,
  `aprobado_por` INT UNSIGNED NULL,
  `aprobado_at` DATETIME NULL,
  `pagado_at` DATETIME NULL,
  `notas` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_nomina_periodos_codigo` (`codigo`),
  KEY `idx_rrhh_nomina_periodos_sub_fechas` (`subsidiaries_id`, `fecha_inicio`, `fecha_fin`),
  KEY `idx_rrhh_nomina_periodos_estatus` (`estatus`),
  CONSTRAINT `fk_rrhh_nomina_periodos_sub` FOREIGN KEY (`subsidiaries_id`) REFERENCES `subsidiaries`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rrhh_nomina_detalle` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `periodo_id` INT UNSIGNED NOT NULL,
  `empleado_id` INT UNSIGNED NOT NULL,
  `dias_laborados` DECIMAL(4,2) NOT NULL DEFAULT 0,
  `dias_faltas` DECIMAL(4,2) NOT NULL DEFAULT 0,
  `dias_vacaciones` DECIMAL(4,2) NOT NULL DEFAULT 0,
  `dias_incapacidad` DECIMAL(4,2) NOT NULL DEFAULT 0,
  `sueldo_diario` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `salario_total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `bonos` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `incentivos` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `descuentos` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `faltas_retardos_descuento` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `extras` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `a_pagar_efectivo` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `a_pagar_bancos` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total_nomina` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `observaciones` TEXT NULL,
  `recibo_numero` VARCHAR(20) NULL,
  `recibo_url` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rrhh_nomina_detalle_periodo_emp` (`periodo_id`, `empleado_id`),
  KEY `idx_rrhh_nomina_detalle_empleado` (`empleado_id`),
  CONSTRAINT `fk_rrhh_nomina_detalle_periodo` FOREIGN KEY (`periodo_id`) REFERENCES `rrhh_nomina_periodos`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rrhh_nomina_detalle_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `rrhh_empleados`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. AUDITORIA
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_autorizaciones_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usr_users_id` INT UNSIGNED NOT NULL,
  `accion` VARCHAR(80) NOT NULL,
  `tabla_afectada` VARCHAR(60) NOT NULL,
  `registro_id` INT UNSIGNED NOT NULL,
  `valor_anterior` TEXT NULL,
  `valor_nuevo` TEXT NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rrhh_auth_log_user` (`usr_users_id`),
  KEY `idx_rrhh_auth_log_accion` (`accion`),
  KEY `idx_rrhh_auth_log_tabla_reg` (`tabla_afectada`, `registro_id`),
  KEY `idx_rrhh_auth_log_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. DOCUMENTOS DEL EXPEDIENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS `rrhh_documentos_empleado` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `empleado_id` INT UNSIGNED NOT NULL,
  `tipo_documento` ENUM('ine','curp','rfc','nss','contrato','comprobante_domicilio','acta_nacimiento','titulo','otros') NOT NULL,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `archivo_url` VARCHAR(255) NOT NULL,
  `tamano_bytes` INT NULL,
  `mime_type` VARCHAR(60) NULL,
  `fecha_vencimiento` DATE NULL,
  `subido_por` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rrhh_docs_emp_tipo` (`empleado_id`, `tipo_documento`),
  KEY `idx_rrhh_docs_vencimiento` (`fecha_vencimiento`),
  CONSTRAINT `fk_rrhh_docs_empleado` FOREIGN KEY (`empleado_id`) REFERENCES `rrhh_empleados`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED: Sucursales (copia de fayxzvov_alpha)
-- ============================================================

INSERT IGNORE INTO `subsidiaries` (`id`, `name`, `companies_id`, `enabled`, `ubication`, `active`, `date_creation`)
SELECT `id`, `name`, `companies_id`, `enabled`, `ubication`, `active`, `date_creation`
FROM `fayxzvov_alpha`.`subsidiaries`;

-- ============================================================
-- SEED: Catalogos
-- ============================================================

INSERT IGNORE INTO `rrhh_puestos` (`nombre`, `color_badge`, `salario_base_sugerido`) VALUES
('Administrador', 'purple', 500.00),
('Gerente',       'purple', 450.00),
('Cocina',        'purple', 280.00),
('Barista',       'blue',   260.00),
('Mesero',        'blue',   240.00),
('Piso',          'blue',   230.00),
('Limpieza',      'gray',   220.00),
('Viewer',        'gray',   200.00);

INSERT IGNORE INTO `rrhh_turnos` (`nombre`, `hora_entrada`, `hora_salida`, `tolerancia_retardo_min`, `duracion_horas`) VALUES
('Matutino',   '07:00:00', '15:00:00', 10, 8.00),
('Vespertino', '15:00:00', '23:00:00', 10, 8.00),
('Nocturno',   '23:00:00', '07:00:00', 10, 8.00),
('Mixto',      '10:00:00', '18:00:00', 15, 8.00);

-- ============================================================
-- SEED: Empleados de prueba
-- ============================================================

INSERT IGNORE INTO `rrhh_empleados` (`codigo_empleado`, `nombre`, `apellido_paterno`, `apellido_materno`, `email`, `telefono`, `puesto_id`, `turno_id`, `subsidiaries_id`, `companies_id`, `tipo_contrato`, `fecha_ingreso`, `salario_diario`, `frecuencia_pago`, `estado`, `created_by`) VALUES
('EMP-0001', 'Carlos',   'Lopez',    'Martinez',  'carlos@test.com',  '9611234567', 1, 1, 1, 1, 'indefinido', '2024-01-15', 500.00, 'quincenal', 'activo', 1),
('EMP-0002', 'Maria',    'Garcia',   'Hernandez', 'maria@test.com',   '9612345678', 3, 1, 1, 1, 'indefinido', '2024-02-01', 280.00, 'quincenal', 'activo', 1),
('EMP-0003', 'Juan',     'Perez',    'Diaz',      'juan@test.com',    '9613456789', 5, 2, 1, 1, 'indefinido', '2024-03-10', 240.00, 'quincenal', 'activo', 1),
('EMP-0004', 'Ana',      'Rodriguez','Soto',       'ana@test.com',    '9614567890', 4, 1, 2, 2, 'temporal',   '2024-06-01', 260.00, 'semanal',   'activo', 1),
('EMP-0005', 'Pedro',    'Jimenez',  'Cruz',       'pedro@test.com',  '9615678901', 6, 2, 2, 2, 'indefinido', '2024-04-15', 230.00, 'quincenal', 'activo', 1),
('EMP-0006', 'Laura',    'Mendez',   'Ruiz',       'laura@test.com',  '9616789012', 2, 1, 1, 1, 'indefinido', '2023-08-20', 450.00, 'quincenal', 'activo', 1);
