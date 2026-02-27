-- =====================================================
-- Script de Base de Datos - Módulo de Inventario
-- Sistema: ERP CoffeeSoft
-- Módulo: Gestión de Movimientos de Inventario
-- =====================================================

-- Tabla principal de movimientos de inventario
CREATE TABLE IF NOT EXISTS `mtto_inventario_movimientos` (
  `id_movimiento` INT(11) NOT NULL AUTO_INCREMENT,
  `folio` VARCHAR(20) NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_movimiento` ENUM('Entrada', 'Salida') NOT NULL,
  `total_productos` INT(11) NOT NULL DEFAULT 0,
  `total_unidades` INT(11) NOT NULL DEFAULT 0,
  `estado` ENUM('Activa', 'Cancelada') NOT NULL DEFAULT 'Activa',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_movimiento`),
  UNIQUE KEY `uk_folio` (`folio`),
  KEY `idx_fecha` (`fecha`),
  KEY `idx_tipo_movimiento` (`tipo_movimiento`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_tipo` (`fecha`, `tipo_movimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de detalle de productos por movimiento
CREATE TABLE IF NOT EXISTS `mtto_inventario_detalle` (
  `id_detalle` INT(11) NOT NULL AUTO_INCREMENT,
  `id_movimiento` INT(11) NOT NULL,
  `id_producto` INT(11) NOT NULL,
  `cantidad` INT(11) NOT NULL,
  `stock_anterior` INT(11) NOT NULL,
  `stock_resultante` INT(11) NOT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `idx_movimiento` (`id_movimiento`),
  KEY `idx_producto` (`id_producto`),
  KEY `idx_movimiento_producto` (`id_movimiento`, `id_producto`),
  CONSTRAINT `fk_detalle_movimiento` 
    FOREIGN KEY (`id_movimiento`) 
    REFERENCES `mtto_inventario_movimientos` (`id_movimiento`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_detalle_producto` 
    FOREIGN KEY (`id_producto`) 
    REFERENCES `mtto_almacen` (`idAlmacen`) 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE,
  CONSTRAINT `chk_cantidad_positiva` 
    CHECK (`cantidad` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Datos iniciales (opcional)
-- =====================================================

-- Insertar movimiento de ejemplo (comentado por defecto)
-- INSERT INTO `mtto_inventario_movimientos` 
-- (`folio`, `fecha`, `tipo_movimiento`, `total_productos`, `total_unidades`, `estado`) 
-- VALUES 
-- ('MOV-001', CURDATE(), 'Entrada', 0, 0, 'Activa');

-- =====================================================
-- Notas de implementación
-- =====================================================
-- 1. La tabla mtto_almacen debe existir previamente
-- 2. El campo 'cantidad' en mtto_almacen representa el stock actual
-- 3. Los índices están optimizados para búsquedas por fecha y tipo
-- 4. El constraint CHECK valida cantidades positivas
-- 5. ON DELETE CASCADE elimina detalles al eliminar movimiento
-- 6. ON DELETE RESTRICT previene eliminar productos con movimientos
