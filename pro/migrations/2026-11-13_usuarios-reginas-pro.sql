-- =============================================================================
-- Personal de Reginas en PRO: alpha -> fayxzvov_app (decision B, 2a parte)
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app); lee fayxzvov_alpha
-- Requiere:  2026-11-13_roles-reginas-pro.sql (roles Cajera, Supervisor, Produccion)
-- Rollback:  2026-11-13_usuarios-reginas-pro-rollback.sql
--
-- Copia los usuarios ACTIVOS de alpha de las sucursales de Reginas con rol
-- Cajero (2), Supervisor (6, 7) o Produccion (8). Al 13/11/2026 son 10, todos
-- de Guadalupe. Administrador y Vendedor no se copian (Andrea ya es la Duena;
-- Vendedor no existe en PRO).
--
-- Contrasena: NULL. PRO valida con bcrypt y alpha guarda MD5, asi que no se
-- puede copiar. Mientras sea NULL el login responde «Correo o contrasena
-- incorrectos»: el administrador le pone una en Developer > Accesos > Usuarios.
--
-- Sucursales: se resuelven por NOMBRE en la empresa (los ids de branches pueden
-- no ser iguales en prod). Se puede volver a correr: no duplica nada.
-- =============================================================================

SET @company_id = (SELECT id FROM companies WHERE name = 'Reginas' LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS _map_suc;
CREATE TEMPORARY TABLE _map_suc (alpha_id INT PRIMARY KEY, branch_id INT);

INSERT INTO _map_suc (alpha_id, branch_id)
SELECT m.alpha_id, b.id
FROM (
    SELECT 4  AS alpha_id, 'Reginas Guadalupe' AS name UNION ALL
    SELECT 25,             'Reginas Kafeto'            UNION ALL
    SELECT 22,             'Reginas Cuarta'
) m
INNER JOIN branches b
    ON b.company_id = @company_id
    AND b.name = m.name;

DROP TEMPORARY TABLE IF EXISTS _map_rol;
CREATE TEMPORARY TABLE _map_rol (alpha_rol INT PRIMARY KEY, role_id INT);

INSERT INTO _map_rol (alpha_rol, role_id)
SELECT m.alpha_rol, r.id
FROM (
    SELECT 2 AS alpha_rol, 'Cajera' AS name UNION ALL
    SELECT 6,              'Supervisor'     UNION ALL
    SELECT 7,              'Supervisor'     UNION ALL
    SELECT 8,              'Producción'
) m
INNER JOIN roles r
    ON r.company_id = @company_id
    AND r.name = m.name;

-- Personas: una por correo (usr_users.user ya es el correo en Reginas).
INSERT INTO users (name, last_name, email, password, branch_id, company_id, is_owner, status, created_at)
SELECT TRIM(a.fullname), NULL, LOWER(TRIM(a.user)), NULL, s.branch_id, @company_id, 0, 'active', NOW()
FROM fayxzvov_alpha.usr_users a
INNER JOIN _map_suc s ON s.alpha_id = a.subsidiaries_id
INNER JOIN _map_rol r ON r.alpha_rol = a.usr_rols_id
WHERE a.active = 1
    AND a.user LIKE '%@%'
    AND NOT EXISTS (
        SELECT 1 FROM users u
        WHERE LOWER(u.email) = LOWER(TRIM(a.user))
    );

-- Accesos: su sucursal de alpha y las de usr_user_subsidiaries, con su rol.
INSERT INTO users_braches (user_id, branch_id, role_id)
SELECT DISTINCT u.id, s.branch_id, r.role_id
FROM fayxzvov_alpha.usr_users a
INNER JOIN users u
    ON LOWER(u.email) = LOWER(TRIM(a.user))
    AND u.company_id = @company_id
INNER JOIN _map_rol r ON r.alpha_rol = a.usr_rols_id
INNER JOIN (
    SELECT id AS usr_users_id, subsidiaries_id FROM fayxzvov_alpha.usr_users
    UNION
    SELECT usr_users_id, subsidiaries_id FROM fayxzvov_alpha.usr_user_subsidiaries
) x ON x.usr_users_id = a.id
INNER JOIN _map_suc s ON s.alpha_id = x.subsidiaries_id
WHERE a.active = 1
    AND NOT EXISTS (
        SELECT 1 FROM users_braches ub
        WHERE ub.user_id = u.id
            AND ub.branch_id = s.branch_id
    );

DROP TEMPORARY TABLE IF EXISTS _map_suc;
DROP TEMPORARY TABLE IF EXISTS _map_rol;

-- Comprobacion al 13/11/2026: Cajera 7, Supervisor 2, Produccion 1 (Guadalupe).
SELECT r.name AS rol, b.name AS sucursal, COUNT(*) AS usuarios,
       SUM(u.password IS NULL) AS sin_contrasena
FROM users_braches ub
INNER JOIN users u    ON u.id = ub.user_id
INNER JOIN roles r    ON r.id = ub.role_id
INNER JOIN branches b ON b.id = ub.branch_id
WHERE u.company_id = @company_id
GROUP BY r.name, b.name
ORDER BY b.name, r.name;
