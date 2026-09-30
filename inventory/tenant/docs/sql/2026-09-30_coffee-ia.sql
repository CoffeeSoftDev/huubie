-- =====================================================================
-- CoffeeIA desde el Administrador (inventory/tenant)
-- Fecha: 30/09/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   1. Tabla `ia_assistants`: un renglón por asistente (hoy solo el del
--      catálogo del almacén). Guarda los modelos, el esfuerzo y el prompt.
--   2. Tabla `ia_company_access`: apaga o enciende un asistente por empresa.
--
-- NULL = "LO DE SIEMPRE"
--   text_model, vision_model y think en NULL siguen al .env
--   (coffee/app/credentials/.env) y a las constantes de conf/_IaOllama.php.
--   prompt en NULL sigue al archivo de prompt_file. Así, correr esta
--   migración no le cambia nada a nadie hasta que alguien edite desde el tenant.
--
-- SIN RENGLÓN = ENCENDIDO
--   Una empresa sin renglón en ia_company_access tiene el asistente
--   encendido: las empresas que ya lo usan no se quedan sin él.
--
-- IDEMPOTENTE: se puede correr dos veces sin duplicar ni romper.
-- =====================================================================

-- Sin esto, un cliente en latin1 guarda "Catálogo" con los acentos rotos.
SET NAMES utf8mb4;


-- 1) ASISTENTES ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.ia_assistants (
    id           INT(11)      NOT NULL AUTO_INCREMENT,
    code         VARCHAR(40)  NOT NULL,
    name         VARCHAR(80)  NOT NULL,
    description  VARCHAR(255)     NULL DEFAULT NULL,
    module       VARCHAR(120)     NULL DEFAULT NULL,
    prompt_file  VARCHAR(255)     NULL DEFAULT NULL,
    text_model   VARCHAR(80)      NULL DEFAULT NULL,
    vision_model VARCHAR(80)      NULL DEFAULT NULL,
    think        VARCHAR(10)      NULL DEFAULT NULL,
    prompt       MEDIUMTEXT       NULL,
    is_active    SMALLINT(6)      NULL DEFAULT 1,
    created_at   DATETIME         NULL DEFAULT NULL,
    updated_at   DATETIME         NULL DEFAULT NULL,
    updated_by   INT(11)          NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ia_assistants_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 2) ACCESO POR EMPRESA --------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.ia_company_access (
    id            INT(11)     NOT NULL AUTO_INCREMENT,
    companies_id  INT(11)     NOT NULL,
    assistants_id INT(11)     NOT NULL,
    is_active     SMALLINT(6)     NULL DEFAULT 1,
    updated_at    DATETIME        NULL DEFAULT NULL,
    updated_by    INT(11)         NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ia_company_access (companies_id, assistants_id),
    KEY idx_ia_company_access_assistant (assistants_id),
    CONSTRAINT fk_ia_company_access_assistant
        FOREIGN KEY (assistants_id) REFERENCES fayxzvov_erp.ia_assistants (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 3) EL ASISTENTE QUE YA EXISTE -------------------------------------------
-- El code es la llave con la que ctrl-almacen.php lo busca: no cambiarlo.
-- En el UPDATE no se tocan modelos ni prompt: re-correr no pisa lo editado.
INSERT INTO fayxzvov_erp.ia_assistants
    (code, name, description, module, prompt_file, is_active, created_at)
VALUES
    ('almacen-catalogo', 'Catálogo del almacén',
     'Altas, cambios, bajas y reactivaciones de productos, categorías, unidades, áreas, almacenes y proveedores.',
     'operacion/almacen', 'operacion/almacen/ia/asistente-catalogo.md', 1, NOW())
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    description = VALUES(description),
    module      = VALUES(module),
    prompt_file = VALUES(prompt_file);
