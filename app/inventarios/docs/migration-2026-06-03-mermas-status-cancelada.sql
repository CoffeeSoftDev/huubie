-- ════════════════════════════════════════════════════════════════════════
--  Migracion: estado 'Cancelada' para mermas (inventory_shrinkage)
--  Fecha: 2026-06-03
--
--  Contexto: el ENUM status de inventory_shrinkage era ('Aplicada','Revertida'),
--  pero TODO el flujo de cancelar una merma usa 'Cancelada' (qCancelMerma, el
--  badge _statusBadge, el frontend pos-mermas.js: m.status === 'Cancelada', el
--  boton "Cancelar" y el mensaje "Merma cancelada"). Al no existir 'Cancelada'
--  en el ENUM, MySQL truncaba el valor a '' (warning 1265 "Data truncated") y la
--  columna Estado salia vacia en el visor.
--
--  Se alinea con inventory_inflow, que ya usa 'Cancelada'.
--
--  YA APLICADA en BD local (fayxzvov_reginas). Ejecutar en produccion.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Superset temporal para poder migrar las filas existentes sin perderlas.
ALTER TABLE inventory_shrinkage
    MODIFY COLUMN status ENUM('Aplicada','Revertida','Cancelada') NOT NULL DEFAULT 'Aplicada';

-- 2) Normaliza datos historicos:
--    - 'Revertida'  -> 'Cancelada' (vocabulario nuevo)
--    - ''           -> 'Cancelada' (filas que se truncaron al intentar cancelar)
UPDATE inventory_shrinkage SET status = 'Cancelada' WHERE status IN ('Revertida', '');

-- 3) ENUM final: solo 'Aplicada' / 'Cancelada'.
ALTER TABLE inventory_shrinkage
    MODIFY COLUMN status ENUM('Aplicada','Cancelada') NOT NULL DEFAULT 'Aplicada';
