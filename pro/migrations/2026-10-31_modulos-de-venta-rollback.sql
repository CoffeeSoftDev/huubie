-- Deshace 2026-10-31_modulos-de-venta.sql: borra los cuatro modulos.
--
-- plan_module y subscription_module tienen ON DELETE CASCADE hacia modules:
-- borrar un modulo lo quita de los planes y de las suscripciones Personalizado
-- que lo tengan (y el total de esas suscripciones baja). Revisa antes en
-- Facturacion › Modulos quien lo paga.

DELETE FROM modules WHERE code IN ('inventarios', 'produccion', 'pos', 'lealtad');
