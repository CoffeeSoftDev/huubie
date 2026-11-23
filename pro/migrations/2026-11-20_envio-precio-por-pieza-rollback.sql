-- =============================================================================
-- Rollback de 2026-11-20_envio-precio-por-pieza.sql
-- Fecha:     20/11/2026
-- BD:        fayxzvov_pos
--
-- Regresa el grupo 12 «Envio a Domicilio» a «Una sola · precio por porción»
-- (is_extra = 0), como venía de alpha.
-- =============================================================================

UPDATE fayxzvov_pos.modifier_group
SET    is_extra   = 0,
       updated_at = NOW()
WHERE  id = 12
  AND  LOWER(name) = 'envio a domicilio'
  AND  is_extra = 1;

SELECT id, name, is_extra, company_id FROM fayxzvov_pos.modifier_group WHERE id = 12;
