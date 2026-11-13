-- =============================================================================
-- Rollback de 2026-11-13_usuarios-reginas-pro.sql
-- Quita al personal de Reginas que se copio de alpha y sus accesos.
-- Solo borra a quien NUNCA ha entrado (last_login_at NULL): una cuenta ya
-- usada se desactiva en Accesos, no se borra.
-- =============================================================================

SET @company_id = (SELECT id FROM companies WHERE name = 'Reginas' LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS _baja;
CREATE TEMPORARY TABLE _baja (id INT PRIMARY KEY);

INSERT INTO _baja (id)
SELECT u.id
FROM users u
INNER JOIN fayxzvov_alpha.usr_users a
    ON LOWER(TRIM(a.user)) = LOWER(u.email)
WHERE u.company_id = @company_id
    AND IFNULL(u.is_owner, 0) = 0
    AND u.last_login_at IS NULL
    AND a.active = 1
    AND a.usr_rols_id IN (2, 6, 7, 8)
GROUP BY u.id;

DELETE ub FROM users_braches ub INNER JOIN _baja b ON b.id = ub.user_id;
DELETE u  FROM users u          INNER JOIN _baja b ON b.id = u.id;

DROP TEMPORARY TABLE IF EXISTS _baja;

-- Comprobacion: solo debe quedar la Duena (y quien ya haya entrado).
SELECT id, name, email FROM users WHERE company_id = @company_id;
