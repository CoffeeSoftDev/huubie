-- =====================================================================
-- Requisiciones: enlace para compartir el comprobante por WhatsApp
-- Fecha: 27/10/2026
-- BD:    fayxzvov_inventory
--
-- purchase_order.share_token   llave del enlace público del comprobante
--                              (comprobante-requisicion.php?t=...): 32
--                              caracteres hex al azar (random_bytes). Nace la
--                              primera vez que alguien pulsa Compartir; NULL =
--                              nunca se ha compartido. Quien tenga el enlace ve
--                              el comprobante sin iniciar sesión (sin costos).
--
-- CORRER ANTES de subir el código: shareOrden la escribe y el enlace la lee;
-- sin la columna, Compartir falla (el resto del módulo no la usa).
--
-- El -rollback quita la columna: los enlaces ya enviados dejan de abrir.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    ADD COLUMN share_token CHAR(32) NULL DEFAULT NULL COMMENT 'Llave del enlace público del comprobante (Compartir)' AFTER approval_note,
    ADD UNIQUE KEY uq_purchase_order_share_token (share_token);

-- VERIFICACIÓN
SHOW COLUMNS FROM fayxzvov_inventory.purchase_order LIKE 'share_token';
