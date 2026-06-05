-- ════════════════════════════════════════════════════════════════════════
--  Migración: cada categoría pertenece a un almacén  (regla de negocio · 1:N)
--  Fecha: 2026-06-05
--
--  Contexto:
--   El diseño base trata `warehouse` (ubicación física) e `item_category`
--   (clasificación del producto) como ejes ortogonales. Se incorpora la regla
--   de negocio: cada CATEGORÍA pertenece a un ALMACÉN
--   (p. ej. Refrescos/Cervezas → "Almacén Bebidas"; Botana/Lácteos →
--   "Almacén Alimentos"). Relación 1:N (una categoría → un almacén), por lo
--   que basta una FK en `item_category`; no se requiere tabla puente.
--
--   El producto queda asociado a su almacén de forma DERIVADA vía
--   item.category_id → item_category.warehouse_id. El stock físico sigue
--   viviendo en `stock` por almacén, sin cambios.
--
--   warehouse_id es NULL-able: las categorías existentes quedan sin almacén
--   hasta que se asignen desde el catálogo de Categorías.
-- ════════════════════════════════════════════════════════════════════════

USE `fayxzvov_inventory`;

ALTER TABLE `item_category`
  ADD COLUMN `warehouse_id` INT NULL AFTER `name`,
  ADD KEY `idx_item_category_warehouse` (`warehouse_id`),
  ADD CONSTRAINT `fk_item_category_warehouse`
      FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`);
