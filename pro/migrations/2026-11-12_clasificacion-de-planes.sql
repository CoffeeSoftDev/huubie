-- =====================================================================
-- Clasificacion de planes (la pagina donde se publica cada uno) y planes
-- en los que el cliente elige N modulos
-- Fecha: 12/11/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-11-12_clasificacion-de-planes-rollback.sql
--
--   plans_classification   la pagina o vitrina donde se publica un plan:
--                          Huubie · Pedidos, Huubie · Eventos, CoffeeSoft.
--                          code es lo que pide cada pagina para traer sus planes.
--   classification_plan    que planes salen en cada clasificacion. Un plan puede
--                          salir en varias (Empresarial, Personalizado).
--   plans.modules_mode     + 'pick': el cliente elige modules_pick modulos de
--                          todos los que se venden y paga el precio fijo del plan.
--   plans.modules_pick     cuantos modulos elige en un plan 'pick'.
--
-- plans_classification ya existia vacia y en MyISAM: pasa a InnoDB (sin eso sus
-- llaves foraneas no existirian), el id se vuelve AUTO_INCREMENT, active pasa de
-- texto a TINYINT y se agregan code y fechas.
--
-- Se puede volver a correr: cada cambio revisa antes si ya esta hecho.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans_classification' AND COLUMN_NAME = 'code') > 0, 'DO 0',
              'ALTER TABLE plans_classification
                  ENGINE = InnoDB,
                  MODIFY id INT(11) NOT NULL AUTO_INCREMENT,
                  MODIFY name VARCHAR(100) NOT NULL,
                  ADD COLUMN code VARCHAR(50) NULL DEFAULT NULL AFTER name,
                  MODIFY description VARCHAR(255) NULL DEFAULT NULL AFTER code,
                  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER description,
                  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
                  MODIFY active TINYINT NOT NULL DEFAULT 1 AFTER updated_at,
                  ADD UNIQUE KEY code (code)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS classification_plan (
    id                INT(11) NOT NULL AUTO_INCREMENT,
    classification_id INT(11) NOT NULL,
    plan_id           INT(11) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY classification_plan_unique (classification_id, plan_id),
    KEY plan_id (plan_id),
    CONSTRAINT classification_plan_ibfk_1 FOREIGN KEY (classification_id) REFERENCES plans_classification (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT classification_plan_ibfk_2 FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_mode'
                 AND COLUMN_TYPE LIKE '%pick%') > 0, 'DO 0',
              "ALTER TABLE plans MODIFY modules_mode ENUM('included','all','custom','pick') NOT NULL DEFAULT 'included'");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_pick') > 0, 'DO 0',
              'ALTER TABLE plans ADD COLUMN modules_pick INT(11) NULL DEFAULT NULL AFTER modules_mode');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Las tres paginas donde hoy se venden planes.
INSERT INTO plans_classification (name, code, description, active)
SELECT 'Huubie · Pedidos', 'huubie-pedidos', 'Página de precios del sistema de pedidos de Huubie', 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans_classification WHERE code = 'huubie-pedidos');

INSERT INTO plans_classification (name, code, description, active)
SELECT 'Huubie · Eventos', 'huubie-eventos', 'Página de precios del sistema de eventos de Huubie', 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans_classification WHERE code = 'huubie-eventos');

INSERT INTO plans_classification (name, code, description, active)
SELECT 'CoffeeSoft', 'coffeesoft', 'Página de precios de CoffeeSoft: planes por cantidad de módulos', 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans_classification WHERE code = 'coffeesoft');

-- Los planes que ya existen son los de Huubie. Empresarial trae los dos
-- productos y sale en las dos paginas; Personalizado sale en las tres.
INSERT INTO classification_plan (classification_id, plan_id)
SELECT c.id, p.id
FROM plans_classification c
INNER JOIN plans p
        ON (c.code = 'huubie-pedidos' AND p.code IN ('starter', 'pro', 'empresarial', 'personalizado'))
        OR (c.code = 'huubie-eventos' AND p.code IN ('empresarial', 'personalizado'))
        OR (c.code = 'coffeesoft'     AND p.code = 'personalizado')
WHERE NOT EXISTS (SELECT 1 FROM classification_plan cp WHERE cp.classification_id = c.id AND cp.plan_id = p.id);
