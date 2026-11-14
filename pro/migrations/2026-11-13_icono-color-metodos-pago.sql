-- =============================================================================
-- Icono y color de los metodos de pago
-- Fecha:     13/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-13_icono-color-metodos-pago-rollback.sql
--
-- Antes:  payment_method solo tenia nombre y clave; en la caja todos se veian igual.
-- Despues payment_method.icon   nombre Lucide de una lista fija (banknote, credit-card...)
--         payment_method.color  hex #RRGGBB del distintivo
--         NULL en los dos = el Catalogo pinta el icono y el gris por defecto.
--
-- La lista de iconos validos vive en pro/app/catalogo/ctrl/ctrl-metodos-pago.php
-- (paymentIcons). Las 3 plantillas de Huubie (company_id NULL) se pintan con su
-- icono y color; si alguien ya les puso otro, no se tocan (icon IS NULL).
--
-- Se puede volver a correr: las columnas se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas la pestana
-- Metodos de pago falla al listar.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'icon') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.payment_method ADD COLUMN icon VARCHAR(40) NULL DEFAULT NULL COMMENT 'nombre Lucide; NULL = icono por defecto' AFTER kind");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'color') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.payment_method ADD COLUMN color CHAR(7) NULL DEFAULT NULL COMMENT 'hex #RRGGBB; NULL = gris' AFTER icon");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Plantillas de Huubie
UPDATE fayxzvov_pos.payment_method SET icon = 'banknote',         color = '#16A34A' WHERE company_id IS NULL AND code = 'CASH'     AND icon IS NULL;
UPDATE fayxzvov_pos.payment_method SET icon = 'credit-card',      color = '#2563EB' WHERE company_id IS NULL AND code = 'CARD'     AND icon IS NULL;
UPDATE fayxzvov_pos.payment_method SET icon = 'arrow-left-right', color = '#7C3AED' WHERE company_id IS NULL AND code = 'TRANSFER' AND icon IS NULL;
