-- =====================================================================
-- Modulo Developer dividido por secciones
-- Fecha: 27/10/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-10-27_modulo-developer-secciones-rollback.sql
--
-- El modulo y sus tres secciones ya existian, pero sin code, icon, route ni
-- orden. Sin route el sidebar no tiene a donde llevar, y sin code ni las
-- paginas ni los ctrl pueden preguntar por su permiso
-- (core/security/_Permission.php).
--
--   modulo Developer  -> app/developer           (la tarjeta DEV de empresas)
--   Accesos           -> app/developer/accesos.php
--   Facturacion       -> app/developer/facturacion.php     (+ cupones y canjes)
--   Personalizacion   -> app/developer/personalizacion.php (+ CoffeeIA)
--
-- Se buscan por nombre y no por id: los id cambian de una base a otra.
-- utf8mb4_general_ci compara sin acentos, asi que 'Facturacion' encuentra
-- 'Facturación'.
--
-- Y lo que Personalizacion trae de inventory y aqui faltaba:
--   themes.sidebar_color   el color del rail lateral (inventory
--                          2026-10-17_tema-sidebar.sql). NULL = sigue a la pagina.
--   coffeeia_config id 1   la unica fila de la configuracion de CoffeeIA
--                          (inventory 2026-09-30_coffeeia-config.sql).
-- Las dos se pueden volver a correr.
-- =====================================================================

UPDATE modules
   SET code = 'developer', icon = 'code-xml', route = 'app/developer', orden = 1
 WHERE name = 'Developer';

UPDATE sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'developer'
   SET s.code = 'accesos', s.icon = 'shield', s.route = 'app/developer/accesos.php', s.orden = 1
 WHERE s.name = 'Accesos';

UPDATE sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'developer'
   SET s.code = 'facturacion', s.icon = 'credit-card', s.route = 'app/developer/facturacion.php', s.orden = 2
 WHERE s.name = 'Facturacion';

UPDATE sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'developer'
   SET s.code = 'personalizacion', s.icon = 'palette', s.route = 'app/developer/personalizacion.php', s.orden = 3
 WHERE s.name = 'Personalizacion';

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME   = 'themes'
                 AND COLUMN_NAME  = 'sidebar_color') > 0, 'DO 0',
              'ALTER TABLE themes ADD COLUMN sidebar_color VARCHAR(20) NULL DEFAULT NULL COMMENT ''hex del rail lateral; NULL = sigue a la pagina'' AFTER secondary_color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

INSERT IGNORE INTO coffeeia_config (id) VALUES (1);
