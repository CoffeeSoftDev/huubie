-- =====================================================================
-- Temas del navbar por empresa
-- Fecha: 03/10/2026
-- BD:    fayxzvov_erp
--
-- Regla acordada:
--   - El Super Admin (rol 'superadmin' en su sucursal activa) ve TODOS los
--     temas activos.
--   - Los demás ven los temas asignados a su empresa MÁS el tema por defecto
--     (themes.is_default = 1, hoy "Claro"). Una empresa sin asignaciones ve
--     solo el de por defecto.
--   - Se asignan en Tenant > Facturación > Empresas > acción "Temas".
--
-- 1) Tabla company_themes: una fila por (empresa, tema) permitido.
-- 2) Siembra: a cada empresa se le asignan los temas que sus usuarios ya
--    tienen elegidos (users.theme_code), para que nadie pierda el suyo al
--    subir el código. El de por defecto no se siembra: siempre está.
--
-- CORRER ANTES de subir el código: themes() / saveTheme() (acceso/ctrl/
-- ctrl-access.php) y las acciones de Empresas en tenant leen esta tabla.
--
-- IDEMPOTENTE: CREATE IF NOT EXISTS + INSERT IGNORE sobre la llave única.
-- El -rollback borra la tabla.
-- =====================================================================


-- 1) TABLA ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.company_themes (
    id         INT(11)  NOT NULL AUTO_INCREMENT,
    company_id INT(11)  NOT NULL,
    theme_id   INT(11)  NOT NULL,
    created_at DATETIME     NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_themes (company_id, theme_id),
    KEY idx_company_themes_theme (theme_id),
    CONSTRAINT fk_company_themes_company FOREIGN KEY (company_id)
        REFERENCES fayxzvov_erp.companies (id) ON DELETE CASCADE,
    CONSTRAINT fk_company_themes_theme FOREIGN KEY (theme_id)
        REFERENCES fayxzvov_erp.themes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 2) SIEMBRA -------------------------------------------------------------
INSERT IGNORE INTO fayxzvov_erp.company_themes (company_id, theme_id, created_at)
SELECT DISTINCT u.company_id, t.id, NOW()
  FROM fayxzvov_erp.users u
  JOIN fayxzvov_erp.themes t    ON t.code = u.theme_code AND t.is_active = 1
  JOIN fayxzvov_erp.companies c ON c.id = u.company_id
 WHERE COALESCE(t.is_default, 0) = 0;


-- 3) VERIFICACIÓN --------------------------------------------------------
SELECT c.name AS empresa, t.code AS tema, t.name AS nombre
  FROM fayxzvov_erp.company_themes ct
  JOIN fayxzvov_erp.companies c ON c.id = ct.company_id
  JOIN fayxzvov_erp.themes    t ON t.id = ct.theme_id
 ORDER BY c.id, t.orden, t.id;
