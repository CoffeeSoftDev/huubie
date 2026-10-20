-- =====================================================================
-- Historial de surtimiento de la requisición
-- Fecha: 20/10/2026
-- BD:    fayxzvov_inventory
--
-- Cada vez que Surtir le entrega algo a una requisición queda un renglón:
-- cuándo, quién, cuántas unidades, cuánto costó y el tipo de salida:
--   auto   = «Sí, descontarlos»: la salida SI- descontó el almacén al momento
--            (inventory_shrinkage_id la liga).
--   manual = «No, lo haré manual»: solo se marcó lo entregado; la salida del
--            almacén se hace a mano después.
-- El modal «Terminar de surtir» (requisición Surtido parcialmente) lo muestra
-- como Historial de surtimiento. Revertir el despacho lo apaga (active = 0).
--
-- CORRER ANTES de subir el código: surtir() escribe aquí y getOrden lo lee;
-- sin la tabla, surtir una requisición falla.
--
-- Idempotente. El -rollback borra la tabla.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_inventory.purchase_order_supply (
    id                     INT(11)     NOT NULL AUTO_INCREMENT,
    purchase_order_id      INT(11)     NOT NULL,
    exit_type              VARCHAR(10) NOT NULL COMMENT 'auto = salida automática (SI-); manual = salida a mano después',
    inventory_shrinkage_id INT(11)     NULL     COMMENT 'Salida SI- que generó (solo auto)',
    warehouse_id           INT(11)     NULL     COMMENT 'Almacén del que se surtió',
    total_products         INT(11)     NOT NULL DEFAULT 0,
    total_units            DOUBLE      NOT NULL DEFAULT 0,
    total_cost             DOUBLE      NOT NULL DEFAULT 0,
    user_id                INT(11)     NULL     COMMENT 'Quién surtió',
    companies_id           INT(11)     NOT NULL,
    created_at             DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active                 TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_purchase_order_supply_order (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- VERIFICACIÓN
SHOW COLUMNS FROM fayxzvov_inventory.purchase_order_supply;
