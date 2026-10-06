-- =====================================================================
-- coffeeIA encendido / apagado  (inventory · Administrador > CoffeeIA)
-- Fecha: 06/10/2026
-- BD:    fayxzvov_erp
--
-- coffeeia_config.active   1 = el ícono de coffeeIA sale al pie del menú
--                          lateral del Catálogo (almacen/index.php) y el
--                          chat contesta.
--                          0 = no sale y askAsistente lo niega.
--
-- Nace en 1: todo sigue como hoy hasta que alguien lo apague.
--
-- CORRER DESPUÉS de 2026-09-30_coffeeia-config.sql (crea la tabla) y ANTES
-- de subir el código: getCoffeeIAConfig (mdl-coffeeia) y getCoffeeIAConfigById
-- (mdl-almacen) ya leen esta columna. Sin ella la pestaña CoffeeIA dice que
-- falta la migración y el Catálogo deja el ícono encendido.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_erp.coffeeia_config
    ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER id;

SELECT id, active, tone, model, effort, vision_model, updated_at FROM fayxzvov_erp.coffeeia_config;
