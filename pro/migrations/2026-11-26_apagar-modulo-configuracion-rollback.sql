-- Deshace 2026-11-26_apagar-modulo-configuracion.sql: vuelve a encender el
-- modulo. Regresa tambien el "Configuración" gris del menu lateral en las
-- empresas cuyo plan lo incluye.

UPDATE modules SET is_active = 1 WHERE code = 'configuracion';
