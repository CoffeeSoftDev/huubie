-- =============================================================================
-- Rollback de 2026-11-09_modulos-pos-h02.sql
-- Fecha: 09/11/2026
-- Borra las secciones pos-*, sus permisos (CASCADE), los submodulos pos-* y el
-- modulo Configuracion. Regresa `catalogo` a su modulo y lo vuelve a encender.
-- =============================================================================

-- 1) `catalogo` vuelve al modulo Catalogo, sin submodulo.
UPDATE modules SET is_active = 1 WHERE code = 'catalogo';

UPDATE sections s
INNER JOIN modules m ON m.code = 'catalogo'
   SET s.module_id = m.id, s.submodule_id = NULL, s.orden = 1
 WHERE s.code = 'catalogo';

-- 2) Secciones nuevas. permissions y permissions_roles caen por CASCADE.
DELETE FROM sections
 WHERE code IN ('pos-ventas', 'pos-pedidos', 'pos-calendario', 'pos-clientes', 'pos-puntos',
                'pos-ecommerce', 'pos-whatsapp', 'pos-dashboard', 'pos-tickets', 'pos-historial');

-- 3) Submodulos de POS.
DELETE FROM submodules WHERE code IN ('pos-tpv', 'pos-reportes', 'pos-catalogo');

-- 4) Modulo Configuracion (sin secciones; si se le agregaron, caen por CASCADE).
DELETE FROM modules WHERE code = 'configuracion';
