-- ============================================================================
--  Rollback del seed 01 — quita los diez productos puente de ejemplo
--
--  Se borran de verdad y no se marcan inactivos: son datos de ejemplo, no
--  catalogo real, y un puente inactivo con precio seguiria estorbando en las
--  pantallas de Catalogos sin servir para nada.
--
--  Los tickets ya generados con ellos NO se tocan: sus renglones viven en
--  detail_virtual_ticket con la descripcion escrita, no con el id del producto,
--  asi que un papel impreso sigue diciendo lo mismo despues de esto.
--
--  Si el dia se va a regenerar, primero deshacer el dia: sin ningun puente en el
--  catalogo el cierre se detiene y no arma papel al 0%.
-- ============================================================================

USE fayxzvov_facturacion;

DELETE FROM product WHERE code LIKE 'PTE%';
