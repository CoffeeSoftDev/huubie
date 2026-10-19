-- =====================================================================
-- Catálogo > Productos: presentaciones de un producto (plano PL-261018-01)
-- Fecha: 18/10/2026
-- BD:    fayxzvov_inventory
--
-- item_presentation   el empaque de un producto que ya existe: «Reja 12» de
--                     COCA COLA LATA es 12 piezas de COCA COLA LATA.
--                     item_id  = el producto BASE (el que se cuenta en stock).
--                     factor   = cuántas unidades del base trae (>= 2).
--                     El factor 1 no se guarda: el producto es su propia base
--                     y la sub-fila «BASE» se dibuja desde el producto.
--
-- Se da de alta desde «Nuevo Producto» con el interruptor ¿Es una
-- presentación? (addMaterial) y se ve como sub-fila del producto base.
-- No toca stock, entradas ni salidas.
--
-- CORRER ANTES de subir el código: lsPresentaciones (ctrl-almacen) la lee al
-- pintar la tabla de Productos.
--
-- Se puede volver a correr. El -rollback borra la tabla.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_inventory.item_presentation (
    id           INT(11)      NOT NULL AUTO_INCREMENT,
    item_id      INT(11)      NOT NULL,                  -- el producto BASE (item.id)
    name         VARCHAR(160) NOT NULL,                  -- 'Reja 12'
    sku          VARCHAR(40)  DEFAULT NULL,              -- '47003-R'
    factor       DOUBLE       NOT NULL DEFAULT 1,        -- cuántas unidades del base (>= 2)
    unit_id      INT(11)      DEFAULT NULL,              -- unidad del empaque (unit.id)
    cost_unit    DOUBLE       NOT NULL DEFAULT 0,        -- costo de la presentación
    active       TINYINT(4)   NOT NULL DEFAULT 1,
    companies_id INT(11)      NOT NULL,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY item_id (item_id),
    KEY companies_id (companies_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- VERIFICACIÓN: la tabla existe y arranca vacía.
SELECT COUNT(*) AS presentaciones FROM fayxzvov_inventory.item_presentation;
