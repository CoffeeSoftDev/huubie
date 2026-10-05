-- ============================================================================
--  Migracion 23 — la bitacora de auditoria (punto 35)
--
--  El punto 35 pide que el modulo deje dicho QUIEN hizo cada accion y CUANDO.
--  Hoy esa respuesta existe a medias y regada: `import_batch` sabe quien subio un
--  archivo, `generation_run` quien cerro un dia, y nada sabe quien cambio un
--  precio, quien dio de baja un producto, quien reimprimio un ticket o quien
--  borro un mes entero.
--
--  Una sola tabla para las seis acciones, en vez de seis columnas de usuario en
--  seis tablas: lo que se audita es la ACCION, y la accion cruza tablas.
--
--      importacion   se subio un archivo                  (import_batch)
--      confirmacion  se cerro un dia, un mes o un folio   (generation_run)
--      reasignacion  un cargo cambio de folio al cerrar   (detail_sale_payment)
--      catalogo      producto o emisor modificado         (product, branch)
--      reimpresion   se mando una seleccion a la impresora (sale)
--      eliminacion   se borraron los tickets de un dia o los datos de un mes
--
--  ── Solo INSERT ─────────────────────────────────────────────────────────────
--  Ningun controlador hace UPDATE ni DELETE sobre esta tabla, ni siquiera
--  "Eliminar todo": ese reset borra lo operativo de un mes y la bitacora es
--  justamente lo que tiene que sobrevivirle.
--
--  ── Se escribe DESPUES de que la accion salio bien ──────────────────────────
--  Una carga que falla no deja una importacion en la bitacora. Y el renglon no
--  tiene FK a nada de lo que describe: entity/entity_id apuntan con un valor, no
--  con una restriccion, porque la fila afectada puede dejar de existir —un dia
--  eliminado, un mes borrado— y el renglon que lo cuenta tiene que quedarse.
--
--  ── user_name es copia ──────────────────────────────────────────────────────
--  Igual que en `import_batch` y `generation_run`: la bitacora se tiene que
--  poder leer aunque el usuario se de de baja. `user_id` va sin FK por lo mismo.
--
--  ── detail es JSON ──────────────────────────────────────────────────────────
--  El antes y el despues de lo que cambio, o el resumen de la accion. Su forma
--  depende de la accion y la pantalla la lee sin esquema fijo. Pide MySQL 5.7.8
--  o mayor.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-23-bitacora-de-auditoria-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

SET NAMES utf8mb4;


-- -- La bitacora ----------------------------------------------------------------
--
-- Los tres indices salen de las tres preguntas de la pantalla: que paso en un
-- periodo (branch_id, created_at), que hizo tal accion (action) y que le paso a
-- tal fila (entity, entity_id).

CREATE TABLE IF NOT EXISTS audit_log (
    id          INT(11)      NOT NULL AUTO_INCREMENT,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action      VARCHAR(30)  NOT NULL COMMENT 'importacion · confirmacion · reasignacion · catalogo · reimpresion · eliminacion',
    entity      VARCHAR(40)  NOT NULL COMMENT 'tabla afectada: import_batch, generation_run, product, branch, virtual_ticket…',
    entity_id   INT(11)      NULL     COMMENT 'id de la fila afectada',
    label       VARCHAR(120) NOT NULL COMMENT 'lo que se lee en la lista: archivo, GEN-000001, PTE010, 4510…',
    detail      JSON         NULL     COMMENT 'antes y despues, o el resumen de la accion',
    user_id     INT(11)      NULL     COMMENT 'quien tecleo su PIN (tabla user) · sin FK',
    user_name   VARCHAR(100) NULL     COMMENT 'copia del nombre',
    branch_id   INT(11)      NULL,
    PRIMARY KEY (id),
    KEY idx_audit_branch_fecha (branch_id, created_at),
    KEY idx_audit_accion       (action),
    KEY idx_audit_entidad      (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
