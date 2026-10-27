-- ============================================================================
--  Migracion 04 — el dia 30/06/2026 vuelve a quedar sin repartir
--
--  Sus 50 tickets se armaron con el reparto viejo, el que elegia las ventas por
--  monto (la mas grande que cupiera en el hueco de la meta) y dejaba los folios
--  del 0% salteados por todo el dia. El reparto nuevo va folio por folio, asi
--  que ese resultado ya no se puede reproducir ni comparar: el dia se limpia
--  para correrlo de cero.
--
--  Las notas viejas se van con ellos, y es lo que se busca: la nota pasa a ser
--  la posicion de la venta en el dia (1..91 por folio) y las de estas filas
--  eran el consecutivo del grupo 0% (1..50).
--
--  El detalle no se borra a mano: se lo lleva el ON DELETE CASCADE de
--  detail_virtual_ticket.virtual_ticket_id.
--
--  Idempotente: si el dia ya esta limpio no borra nada.
-- ============================================================================

USE fayxzvov_facturacion;

DELETE FROM virtual_ticket
 WHERE issue_date = '2026-06-30'
   AND branch_id  = 1;
