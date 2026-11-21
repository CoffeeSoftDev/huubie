-- =============================================================================
-- «Envio a Domicilio» se cobra una vez, no por porción
-- Fecha:     20/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-06_migrar-reginas-a-pos.sql (crea el grupo 12 desde alpha)
-- Rollback:  2026-11-20_envio-precio-por-pieza-rollback.sql
--
-- Problema (P1688 y P1712): el grupo 12 «Envio a Domicilio» venía de alpha con
-- isExtra = 0 = «Una sola · precio por porción». El pastel personalizado
-- sumaba $130 × porciones: $3,250 en un pastel de 25 porciones y $10,400 en
-- uno de 80 (product.suggested_price 5,230 / 13,200 / 4,670 en local).
--
-- Arreglo: is_extra = 1 = «Varias, con cantidad · precio por pieza», lo mismo
-- que elegir esa opción en Catálogo › Grupos de modificadores. El envío suma
-- $130 × cantidad (1) sin importar las porciones. El grupo tiene una sola
-- opción («Envio a Domicilio» $130).
--
-- Solo cambia una fila de datos; no toca estructura ni pedidos ya guardados
-- (su precio es el que se capturó). Va por id, nombre y valor de antes: si
-- alguien ya lo cambió, no se toca. Se puede volver a correr.
-- =============================================================================

UPDATE fayxzvov_pos.modifier_group
SET    is_extra   = 1,
       updated_at = NOW()
WHERE  id = 12
  AND  LOWER(name) = 'envio a domicilio'
  AND  is_extra = 0;

-- Comprobación: debe salir is_extra = 1.
SELECT id, name, is_extra, company_id FROM fayxzvov_pos.modifier_group WHERE id = 12;
