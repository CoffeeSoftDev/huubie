-- =============================================================================
-- Color del tipo de tarjeta de lealtad
-- Fecha:     15/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-15_color-tipo-tarjeta-rollback.sql
--
-- Antes:  card_type no guardaba color; el dibujo de la tarjeta lo sacaba del nombre.
-- Despues card_type.color  hex #RRGGBB elegido en Ventas > Puntos > Tipos de tarjeta.
--         NULL = celeste claro (#BAE6FD), el color por defecto.
--
-- No toca ningun dato: los tipos que ya existen quedan en NULL y se ven celestes.
-- Tampoco corrige los tipos que hoy tienen descuento Y puntos a la vez: la
-- pantalla ya no deja guardar los dos, y al editar uno de esos pide elegir.
-- La consulta del final los lista.
--
-- Se puede volver a correr: la columna se agrega solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin la columna falla la pagina
-- Puntos (listas y formularios). Vender e Historial no la leen.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'color') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.card_type ADD COLUMN color CHAR(7) NULL DEFAULT NULL COMMENT 'hex #RRGGBB; NULL = celeste claro' AFTER points_percent");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion --

-- Tipos con los dos beneficios: hay que editarlos y dejarles uno solo.
SELECT id, name, discount_percent, points_percent, color, branch_id, active
FROM fayxzvov_pos.card_type
WHERE discount_percent > 0 AND points_percent > 0
ORDER BY branch_id, id;
