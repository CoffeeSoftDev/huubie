-- =============================================================================
-- Tienda en linea (V8 del plan de Ventas)
-- Fecha:     15/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-15_tienda-en-linea-rollback.sql
--
-- Dos tablas nuevas. No toca ninguna existente.
--
-- online_store  la tienda de UNA sucursal (una fila por sucursal).
--   active        0 apagada (el enlace muestra «Tienda cerrada»), 1 recibe pedidos.
--   token         lo que va en el enlace publico: app/order/pedir.php?t=<token>.
--                 «Nuevo enlace» lo cambia y el anterior deja de abrir.
--   title/message portada: titulo y texto de bienvenida.
--   whatsapp      10 digitos; el cliente confirma su pedido por ahi.
--   accent        hex #RRGGBB del color de la tienda; NULL = azul Huubie.
--   bank_info     datos para transferencia; se muestran al terminar el pedido.
--   pickup/delivery       formas de entrega que se ofrecen.
--   pay_transfer/pay_store formas de pago que se ofrecen (transferencia / en tienda).
--   lead_days     dias minimos de anticipacion para la fecha de entrega.
--
-- online_order  el origen de cada pedido que entra por la tienda.
--   La venta vive en sale (sale_type_id 4 = E-commerce, en cotizacion) con sus
--   lineas en detail_sale. Al ACEPTARLO pasa a sale_type_id 1 y aparece en
--   Pedidos y en el calendario. Aqui queda lo que el cliente escribio, como
--   entrega y como paga, y la IP para el limite de pedidos por hora.
--
-- Que productos salen en la tienda: product.in_catalog = 1 (ya existe).
--
-- Se puede volver a correr: cada tabla se crea solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las tablas fallan la pagina
-- Tienda en linea y el enlace publico. Pedidos, Vender e Historial no las leen.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_pos.online_store (
    id            INT(11)      NOT NULL AUTO_INCREMENT,
    branch_id     INT(11)      NOT NULL,
    active        TINYINT(4)   NOT NULL DEFAULT 0,
    token         CHAR(16)     NOT NULL,
    title         VARCHAR(80)  NULL DEFAULT NULL,
    message       VARCHAR(255) NULL DEFAULT NULL,
    whatsapp      VARCHAR(15)  NULL DEFAULT NULL,
    accent        CHAR(7)      NULL DEFAULT NULL COMMENT 'hex #RRGGBB; NULL = azul Huubie',
    bank_info     VARCHAR(500) NULL DEFAULT NULL,
    pickup        TINYINT(4)   NOT NULL DEFAULT 1,
    delivery      TINYINT(4)   NOT NULL DEFAULT 0,
    pay_transfer  TINYINT(4)   NOT NULL DEFAULT 1,
    pay_store     TINYINT(4)   NOT NULL DEFAULT 1,
    lead_days     TINYINT(4)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_online_store_branch (branch_id),
    UNIQUE KEY uq_online_store_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.online_order (
    id             INT(11)      NOT NULL AUTO_INCREMENT,
    sale_id        INT(11)      NOT NULL,
    branch_id      INT(11)      NOT NULL,
    customer_name  VARCHAR(255) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    email          VARCHAR(255) NULL DEFAULT NULL,
    delivery       VARCHAR(10)  NOT NULL COMMENT 'pickup | delivery',
    payment        VARCHAR(10)  NOT NULL COMMENT 'transfer | store',
    ip             VARCHAR(45)  NOT NULL DEFAULT '',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_online_order_sale (sale_id),
    KEY ix_online_order_branch (branch_id, created_at),
    KEY ix_online_order_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- Comprobacion --

SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('online_store', 'online_order');

-- Lo que hoy saldria en la tienda de cada sucursal.
SELECT branch_id, COUNT(*) AS en_tienda
FROM fayxzvov_pos.product
WHERE in_catalog = 1 AND IFNULL(active, 1) = 1 AND IFNULL(is_custom, 0) = 0
GROUP BY branch_id
ORDER BY branch_id;
