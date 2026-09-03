-- ============================================================================
--  Rollback de la migracion 15 — se van los dos folios del papel
--
--  Se pierde la foto: despues de esto el ticket vuelve a depender de `sale` para
--  saber con que folio se imprimio, y el folio de origen solo se puede reconstruir
--  mientras la reasignacion del dia siga vigente en `detail_sale_payment`.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropVirtualTicketFolios;

DELIMITER $$

CREATE PROCEDURE dropVirtualTicketFolios()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND INDEX_NAME   = 'idx_vt_visible'
    ) THEN
        ALTER TABLE virtual_ticket DROP INDEX idx_vt_visible;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND INDEX_NAME   = 'idx_vt_origin'
    ) THEN
        ALTER TABLE virtual_ticket DROP INDEX idx_vt_origin;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'origin_folio'
    ) THEN
        ALTER TABLE virtual_ticket DROP COLUMN origin_folio;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'visible_folio'
    ) THEN
        ALTER TABLE virtual_ticket DROP COLUMN visible_folio;
    END IF;
END$$

DELIMITER ;

CALL dropVirtualTicketFolios();

DROP PROCEDURE IF EXISTS dropVirtualTicketFolios;
