-- =====================================================
-- SCRIPT COMPLETO: Base de Datos con Soporte para Emojis
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- =====================================================

-- ⚠️ IMPORTANTE: Configurar la conexión primero
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 1. CREAR BASE DE DATOS (si no existe)
CREATE DATABASE IF NOT EXISTS `projects_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. USAR LA BASE DE DATOS
USE `projects_db`;

-- 3. Configurar la sesión para utf8mb4
SET character_set_client = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results = utf8mb4;
SET collation_connection = utf8mb4_unicode_ci;

-- 3. CREAR TABLA PROJECTS
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del proyecto',
  `size` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tamaño (con emojis)',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Activo, 0=Inactivo, 2=En Progreso, 3=Completado, 4=Cancelado',
  `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `subsidiaries_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_subsidiaries` (`subsidiaries_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. INSERTAR DATOS DE EJEMPLO (SIN EMOJIS)
INSERT INTO `projects` (`name`, `size`, `status`, `subsidiaries_id`) VALUES
('Proyecto Alpha', 'Pequeño', 1, 1),
('Sistema de Ventas', 'Mediano', 2, 1),
('ERP Empresarial', 'Grande', 2, 1),
('App Movil', 'Pequeño', 3, 1),
('Dashboard Analytics', 'Mediano', 1, 1),
('Proyecto Beta', 'Grande', 4, 1);

-- 5. VERIFICAR CONFIGURACIÓN
SELECT 
    'Base de Datos' as Tipo,
    SCHEMA_NAME as Nombre,
    DEFAULT_CHARACTER_SET_NAME as CharacterSet,
    DEFAULT_COLLATION_NAME as Collation
FROM information_schema.SCHEMATA 
WHERE SCHEMA_NAME = 'projects_db'
UNION ALL
SELECT 
    'Tabla' as Tipo,
    TABLE_NAME as Nombre,
    TABLE_COLLATION as CharacterSet,
    TABLE_COLLATION as Collation
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'projects_db' AND TABLE_NAME = 'projects';
