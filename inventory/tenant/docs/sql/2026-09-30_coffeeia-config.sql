-- =====================================================================
-- Configuración de coffeeIA  (inventory · Administrador > CoffeeIA)
-- Fecha: 30/09/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Tabla `coffeeia_config` con UNA sola fila (id = 1): la configuración
--   global de los chats de coffeeIA de inventory (Catálogo, Entradas y
--   Salidas). La lee conf/_IaOllama.php en cada pregunta.
--
-- COLUMNAS
--   tone          cómo redacta sus respuestas; se suma a las instrucciones
--                 de cada chat, no las reemplaza.
--   model         modelo de razonamiento (el que interpreta y contesta).
--   effort        cuánto razona: off | low | medium | high.
--   vision_model  modelo que lee las fotos (las pasa a texto).
--
--   NULL en cualquiera = manda el .env (IA_PRODUCTOS_MODEL, IA_PRODUCTOS_THINK,
--   IA_VISION_MODEL) y, si tampoco está, la constante de _IaOllama.php.
--
-- IDEMPOTENTE: se puede correr dos veces sin duplicar ni romper.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_erp.coffeeia_config (
    id           INT(11)      NOT NULL,
    tone         VARCHAR(500)     NULL DEFAULT NULL,
    model        VARCHAR(80)      NULL DEFAULT NULL,
    effort       VARCHAR(10)      NULL DEFAULT NULL,
    vision_model VARCHAR(80)      NULL DEFAULT NULL,
    updated_at   DATETIME         NULL DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- La fila única nace vacía: todo sigue como hoy hasta que alguien la edite.
INSERT IGNORE INTO fayxzvov_erp.coffeeia_config (id) VALUES (1);

SELECT id, tone, model, effort, vision_model, updated_at FROM fayxzvov_erp.coffeeia_config;
