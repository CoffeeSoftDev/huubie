-- =====================================================================
-- Orígenes de entrada: descripción
-- Fecha: 06/10/2026
-- BD:    fayxzvov_inventory
--
-- inflow_origin.description   explicación breve de para qué sirve el tipo de
--                             entrada. Se muestra debajo de "Tipo de entrada"
--                             en el formulario previo de Nueva entrada y se
--                             edita en Catálogo > Origen entradas.
--
-- Los textos de abajo son el arranque para los orígenes que ya existen (por code).
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inflow_origin
    ADD COLUMN description VARCHAR(255) NULL AFTER name;

UPDATE fayxzvov_inventory.inflow_origin
SET description = CASE code
    WHEN 'EDA'        THEN 'Se usa para agregar una entrada que no ocupó factura, por ejemplo compras del mercado.'
    WHEN 'COMPRA_SP'  THEN 'Compra pagada en un lugar que no está registrado como proveedor, por ejemplo una tienda de paso.'
    WHEN 'COMPRA'     THEN 'Compra con factura a un proveedor registrado. Pide elegir el proveedor.'
    WHEN 'PROV'       THEN 'Mercancía que entrega un proveedor registrado. Pide elegir el proveedor.'
    WHEN 'AJUSTE'     THEN 'Corrige el stock cuando hay más producto del que dice el sistema.'
    WHEN 'PRODUCCION' THEN 'Producto terminado que sale de una orden de producción.'
    WHEN 'DEVOLUCION' THEN 'Mercancía que regresa al almacén, por ejemplo una devolución.'
    ELSE description
END;
