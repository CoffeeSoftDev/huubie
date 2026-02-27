-- Script SQL para el Módulo de Catálogo
-- Base de datos: rfwsmqex_mtto

-- Tabla: mtto_categoria
CREATE TABLE IF NOT EXISTS `mtto_categoria` (
    `idcategoria` INT(11) NOT NULL AUTO_INCREMENT,
    `nombreCategoria` VARCHAR(255) NOT NULL,
    `active` TINYINT(1) DEFAULT 1,
    `date_creation` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`idcategoria`),
    INDEX `idx_nombreCategoria` (`nombreCategoria`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: mtto_almacen_area
CREATE TABLE IF NOT EXISTS `mtto_almacen_area` (
    `idArea` INT(11) NOT NULL AUTO_INCREMENT,
    `Nombre_Area` VARCHAR(255) NOT NULL,
    `active` TINYINT(1) DEFAULT 1,
    `date_creation` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`idArea`),
    UNIQUE INDEX `idx_unique_nombre_area` (`Nombre_Area`, `active`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: mtto_almacen_zona
CREATE TABLE IF NOT EXISTS `mtto_almacen_zona` (
    `id_zona` INT(11) NOT NULL AUTO_INCREMENT,
    `nombre_zona` VARCHAR(255) NOT NULL,
    `active` INT(1) DEFAULT 1,
    `date_creation` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_zona`),
    INDEX `idx_nombre_zona` (`nombre_zona`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos de ejemplo para pruebas (opcional)
INSERT INTO `mtto_categoria` (`nombreCategoria`, `active`) VALUES
('Herramientas', 1),
('Materiales de Construcción', 1),
('Equipos de Seguridad', 1);

INSERT INTO `mtto_almacen_area` (`Nombre_Area`, `active`) VALUES
('Área A - Principal', 1),
('Área B - Secundaria', 1),
('Área C - Almacenamiento', 1);

INSERT INTO `mtto_almacen_zona` (`nombre_zona`, `active`) VALUES
('Zona 1 - Entrada', 1),
('Zona 2 - Centro', 1),
('Zona 3 - Salida', 1);
