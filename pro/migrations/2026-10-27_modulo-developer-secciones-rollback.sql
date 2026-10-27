-- Deshace 2026-10-27_modulo-developer-secciones.sql: el modulo y sus
-- secciones vuelven a quedar sin code, icon, route ni orden, temas pierde el
-- color del rail y se borra la fila de CoffeeIA (con lo que se haya configurado).

UPDATE sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'developer'
   SET s.code = NULL, s.icon = NULL, s.route = NULL, s.orden = NULL
 WHERE s.code IN ('accesos', 'facturacion', 'personalizacion');

UPDATE modules
   SET code = NULL, icon = NULL, route = NULL, orden = NULL
 WHERE code = 'developer';

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME   = 'themes'
                 AND COLUMN_NAME  = 'sidebar_color') = 0, 'DO 0',
              'ALTER TABLE themes DROP COLUMN sidebar_color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

DELETE FROM coffeeia_config WHERE id = 1;
