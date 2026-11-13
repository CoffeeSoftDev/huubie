-- =============================================================================
-- Datos fiscales y de contacto de la empresa
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Que hace:  agrega a companies lo que el dueño llena en Configuración › Empresa
--            y que hasta hoy no tenia donde guardarse:
--              legal_name   razon social (el nombre con el que factura)
--              tax_regime   clave del regimen fiscal del SAT (601, 612, 626...)
--              zip_code     codigo postal del domicilio fiscal
--              phone        telefono de la empresa
--              email        correo de contacto / de facturacion
--            name, rfc, ubication y logo ya existian.
--            La pagina funciona sin esta migracion: mientras las columnas no
--            existan, simplemente no ofrece esos campos (ctrl-configuracion).
--            Se corre UNA vez: MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS.
-- Rollback:  2026-11-13_datos-fiscales-empresa-rollback.sql
-- =============================================================================

ALTER TABLE companies
    ADD COLUMN legal_name VARCHAR(160) NULL AFTER name,
    ADD COLUMN tax_regime VARCHAR(4)   NULL AFTER rfc,
    ADD COLUMN zip_code   VARCHAR(5)   NULL AFTER tax_regime,
    ADD COLUMN phone      VARCHAR(20)  NULL AFTER ubication,
    ADD COLUMN email      VARCHAR(120) NULL AFTER phone;
