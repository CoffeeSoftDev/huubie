-- =============================================================================
-- Icono de las categorias de producto
-- Fecha:     28/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-28_icono-categorias-rollback.sql
--
-- Antes:  el POS adivinaba el icono de cada categoria por su nombre
--         (OrderForm.categoryIcon: «pastel» -> cake, «bebida» -> cup-soda...;
--         sin coincidencia, package). No habia forma de elegirlo.
-- Despues category.icon  nombre Lucide de una lista fija (cake, coffee, pizza...)
--         NULL = el POS lo sigue adivinando por el nombre.
--
-- La lista de iconos validos vive en pro/app/catalogo/ctrl/ctrl-categorias.php
-- (categoryIcons). No se llena ninguna fila: todas arrancan en NULL y se ven
-- igual que hoy hasta que alguien elija uno en Catalogo de venta › Categorias.
--
-- Se puede volver a correr: la columna se agrega solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin la columna fallan la
-- pestana Categorias, Ventas, la captura de pedidos y la tienda en linea.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'category' AND COLUMN_NAME = 'icon') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.category ADD COLUMN icon VARCHAR(40) NULL DEFAULT NULL COMMENT 'nombre Lucide; NULL = el POS lo elige por el nombre' AFTER description");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
