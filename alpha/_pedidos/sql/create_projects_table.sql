-- =====================================================
-- Tabla: projects
-- Descripción: Tabla para gestionar proyectos
-- Soporte: Emojis en campos de texto (utf8mb4)
-- =====================================================

-- ⚠️ IMPORTANTE: Configurar la conexión primero
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET character_set_client = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results = utf8mb4;
SET collation_connection = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del proyecto',
  `size` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tamaño del proyecto (puede incluir emojis: 📏 Pequeño, 📦 Mediano, 🏢 Grande)',
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Estado: 1=Activo, 0=Inactivo, 2=En Progreso, 3=Completado, 4=Cancelado',
  `date_creation` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  `date_updated` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  `subsidiaries_id` INT(11) DEFAULT NULL COMMENT 'ID de la sucursal',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_subsidiaries` (`subsidiaries_id`),
  KEY `idx_date_creation` (`date_creation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabla de proyectos con soporte para emojis';

-- =====================================================
-- Datos de ejemplo con emojis
-- =====================================================

INSERT INTO `projects` (`name`, `size`, `status`, `subsidiaries_id`) VALUES
('Proyecto Alpha 🚀', '📏 Pequeño', 1, 1),
('Sistema de Ventas 💰', '📦 Mediano', 2, 1),
('ERP Empresarial 🏢', '🏢 Grande', 2, 1),
('App Móvil 📱', '📏 Pequeño', 3, 1),
('Dashboard Analytics 📊', '📦 Mediano', 1, 1),
('Proyecto Beta ⭐', '🏢 Grande', 4, 1);

-- =====================================================
-- Consultas útiles
-- =====================================================

-- Ver todos los proyectos activos
-- SELECT * FROM projects WHERE status = 1;

-- Ver proyectos por tamaño
-- SELECT * FROM projects WHERE size LIKE '%Pequeño%';

-- Ver proyectos en progreso
-- SELECT * FROM projects WHERE status = 2;

-- Contar proyectos por estado
-- SELECT status, COUNT(*) as total FROM projects GROUP BY status;
