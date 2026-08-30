-- ============================================================================
--  Limpieza 01 — se van los datos de prueba
--
--  La base arranco como banco de pruebas de DOS sistemas distintos y quedo con
--  las dos historias encimadas en la misma sucursal:
--
--      379 product  ->  menu de Soft Restaurant (cocina mexicana)
--       24 waiter   ->  17 con codigo numerico (Soft) + 7 con nombre (Wansoft)
--       36 sale     ->  ventas de RYORI RYOKAN cargadas para probar Wansoft
--       38 payment  ->  los pagos de esas 36
--        2 batch    ->  la bitacora de esas dos cargas
--
--  Ninguno es dato de produccion. Se borran para que el primer archivo real
--  entre a una base sin residuos.
--
--  ── Por que se puede borrar el catalogo sin miedo ──────────────────────────
--  Solo dos tablas apuntan a `product` —`detail_sale` y `detail_virtual_ticket`—
--  y las dos estan VACIAS. Ni un renglon de comanda ni un papel generado cuelga
--  de esos 379 productos: no hay nada que se quede colgando.
--
--  Lo mismo con `virtual_ticket`: 0 filas. Nunca se genero una nota, que es la
--  unica razon por la que tener los dos menus revueltos todavia no hizo dano.
--
--  ── Que NO se toca ─────────────────────────────────────────────────────────
--  La configuracion se queda entera, porque no es dato de prueba sino la forma
--  del sistema:
--
--      company · branch · pos · payment_method · sale_status · sale_operation_status
--
--  El alta de la sucursal de Ryori Ryokan NO va aqui: esto solo borra. Separar
--  las dos sucursales es un paso propio y va en su archivo.
--
--  ── Orden ──────────────────────────────────────────────────────────────────
--  De la hoja a la raiz. Varias FKs son ON DELETE CASCADE y bastaria con borrar
--  `sale`, pero se escriben todas: un borrado explicito dice lo que hace y no
--  depende de que la FK siga configurada igual manana.
--
--  El AUTO_INCREMENT vuelve a 1 en cada tabla vaciada. Sin eso la primera venta
--  real nace con id 37 y el primer producto con id 380, que es un rastro de las
--  pruebas dentro de datos que ya no las tienen.
--
--  Idempotente: se puede correr las veces que sea.
--  Respaldo previo en backup/ — este script NO se deshace solo.
-- ============================================================================

USE fayxzvov_facturacion;

SET SQL_SAFE_UPDATES = 0;


-- -- 1. Documentos generados ---------------------------------------------------
--  Van primero: son los que cuelgan de la venta y del catalogo a la vez.

DELETE FROM detail_virtual_ticket;
DELETE FROM virtual_ticket;

ALTER TABLE detail_virtual_ticket AUTO_INCREMENT = 1;
ALTER TABLE virtual_ticket        AUTO_INCREMENT = 1;


-- -- 2. Detalle de la venta ----------------------------------------------------

DELETE FROM detail_sale_payment_card;
DELETE FROM detail_sale_payment;
DELETE FROM detail_sale;
DELETE FROM deleted_sale_payment;

ALTER TABLE detail_sale_payment_card AUTO_INCREMENT = 1;
ALTER TABLE detail_sale_payment      AUTO_INCREMENT = 1;
ALTER TABLE detail_sale              AUTO_INCREMENT = 1;
ALTER TABLE deleted_sale_payment     AUTO_INCREMENT = 1;


-- -- 3. La venta y su resumen --------------------------------------------------

DELETE FROM daily_sale_summary;
DELETE FROM sale;

ALTER TABLE daily_sale_summary AUTO_INCREMENT = 1;
ALTER TABLE sale               AUTO_INCREMENT = 1;


-- -- 4. Catalogos que trajo cada POS -------------------------------------------
--  `product` y `waiter` no son configuracion: los da de alta la carga leyendo el
--  archivo del POS, y por eso se van con las pruebas. `payment_method` SI es
--  configuracion —lo alimenta un seed, no un archivo— y se queda.

DELETE FROM product;
DELETE FROM waiter;
DELETE FROM cashier;

ALTER TABLE product AUTO_INCREMENT = 1;
ALTER TABLE waiter  AUTO_INCREMENT = 1;
ALTER TABLE cashier AUTO_INCREMENT = 1;


-- -- 5. La bitacora de carga ---------------------------------------------------
--  Al final: todo lo anterior la referencia con import_batch_id.

DELETE FROM import_batch;

ALTER TABLE import_batch AUTO_INCREMENT = 1;


SET SQL_SAFE_UPDATES = 1;
