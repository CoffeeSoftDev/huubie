-- =====================================================
-- VERSIÓN SIN EMOJIS (Por si tienes problemas)
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS `projects_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `projects_db`;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `subsidiaries_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos SIN emojis
INSERT INTO `projects` (`name`, `size`, `status`, `subsidiaries_id`) VALUES
('Proyecto Alpha', 'Pequeño', 1, 1),
('Sistema de Ventas', 'Mediano', 2, 1),
('ERP Empresarial', 'Grande', 2, 1),
('App Movil', 'Pequeño', 3, 1),
('Dashboard Analytics', 'Mediano', 1, 1),
('Proyecto Beta', 'Grande', 4, 1);

SELECT * FROM projects;
