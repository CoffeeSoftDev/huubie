-- =====================================================
-- VERSIÓN CON UTF8 ESTÁNDAR (Compatible con MySQL antiguo)
-- NO soporta emojis de 4 bytes, pero funciona en cualquier versión
-- =====================================================

CREATE DATABASE IF NOT EXISTS `projects_db` 
CHARACTER SET utf8 
COLLATE utf8_general_ci;

USE `projects_db`;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT 'Nombre del proyecto',
  `size` VARCHAR(100) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL COMMENT 'Tamaño del proyecto',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Activo, 0=Inactivo, 2=En Progreso, 3=Completado, 4=Cancelado',
  `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  `date_updated` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  `subsidiaries_id` INT(11) DEFAULT NULL COMMENT 'ID de la sucursal',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_subsidiaries` (`subsidiaries_id`),
  KEY `idx_date_creation` (`date_creation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci COMMENT='Tabla de proyectos';

-- Datos de ejemplo SIN emojis
INSERT INTO `projects` (`name`, `size`, `status`, `subsidiaries_id`) VALUES
('Proyecto Alpha', 'Pequeño', 1, 1),
('Sistema de Ventas', 'Mediano', 2, 1),
('ERP Empresarial', 'Grande', 2, 1),
('App Movil', 'Pequeño', 3, 1),
('Dashboard Analytics', 'Mediano', 1, 1),
('Proyecto Beta', 'Grande', 4, 1),
('Sitio Web Corporativo', 'Mediano', 1, 1),
('Sistema de Inventario', 'Grande', 2, 1);

-- Verificar que se creó correctamente
SELECT * FROM projects;

-- Ver la estructura
DESCRIBE projects;
