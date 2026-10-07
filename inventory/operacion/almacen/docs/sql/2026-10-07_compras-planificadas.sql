-- =====================================================================
-- Compras: rutina, programadas y esporádicas
-- Fecha: 07/10/2026
-- BD:    fayxzvov_inventory
--
-- Las compras viven en purchase_order / detail_purchase_order, igual que las
-- órdenes entre sucursales. Se distinguen por purchase_type y por el folio CP-.
--
-- purchase_order.name                     nombre de la compra ("Roscas de Reyes").
-- purchase_order.purchase_type            Rutina | Programada | Esporadica.
--                                         NULL = orden o solicitud entre sucursales
--                                         (Órdenes y Solicitudes no cambian).
-- purchase_order.series_code              RUT-0001: agrupa las fechas de una rutina.
-- purchase_order.weekdays                 días de la rutina, 1 = lunes ... 7 = domingo ("1,4").
-- purchase_order.buyer_name               quién surte (la persona a la que se le da la hoja).
-- purchase_order.origin_purchase_order_id compra que se retomó para armar esta.
-- purchase_order.printed_at               primera impresión de la hoja de surtido.
-- purchase_order.captured_at              cuándo se capturó lo surtido.
-- purchase_order.captured_user_id         quién lo capturó (fayxzvov_erp.users.id). Sin
--                                         FK: users vive en otro esquema, igual que
--                                         edited_user_id de inventory_inflow.
-- detail_purchase_order.purchase_place    dónde se compró el renglón (lo anotado en la hoja).
--
-- Estados de una compra (purchase_order.status): Pendiente -> En surtido
-- (al imprimir la hoja) -> Capturada (al capturar, genera la entrada ENT-
-- ligada por inventory_inflow.purchase_order_id). Cancelada en cualquier punto
-- antes de capturar.
--
-- CORRER ANTES de subir el código: compras.php (ctrl/mdl-compras) lee y escribe
-- estas columnas; sin ellas la pantalla de Compras falla. Órdenes y Solicitudes
-- no las usan (separan las compras por el folio CP-), así que siguen igual.
--
-- El -rollback quita las columnas.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    ADD COLUMN name                     VARCHAR(100) NULL AFTER folio,
    ADD COLUMN purchase_type            VARCHAR(20)  NULL AFTER status,
    ADD COLUMN series_code              VARCHAR(20)  NULL AFTER purchase_type,
    ADD COLUMN weekdays                 VARCHAR(20)  NULL AFTER series_code,
    ADD COLUMN buyer_name               VARCHAR(100) NULL AFTER weekdays,
    ADD COLUMN origin_purchase_order_id INT          NULL AFTER buyer_name,
    ADD COLUMN printed_at               DATETIME     NULL AFTER approved_at,
    ADD COLUMN captured_at              DATETIME     NULL AFTER printed_at,
    ADD COLUMN captured_user_id         INT          NULL AFTER approved_user_id,
    ADD KEY idx_po_purchase_type (companies_id, purchase_type, date_order),
    ADD KEY idx_po_series (series_code),
    ADD KEY idx_po_origin (origin_purchase_order_id),
    ADD KEY idx_po_captured_user (captured_user_id),
    ADD CONSTRAINT fk_po_origin FOREIGN KEY (origin_purchase_order_id)
        REFERENCES fayxzvov_inventory.purchase_order (id);

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    ADD COLUMN purchase_place VARCHAR(100) NULL AFTER subtotal;
