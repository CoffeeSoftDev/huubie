-- =============================================================================
-- Inicio personalizable: el dueño elige y acomoda las tarjetas de su inicio
-- Fecha:     19/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  app/home (ctrl-home, mdl-home-layout, widgets-home, home.js) y
--            app/configuracion (pestaña «Mi inicio») ya subidos. Correr ANTES
--            de subir el codigo: sin home_widgets el inicio del dueño se queda
--            sin tarjetas (solo los avisos de pago).
-- Rollback:  2026-11-19_inicio-personalizable-rollback.sql
--
-- Dos tablas:
--
--   home_widgets       EL CATALOGO. Cada tarjeta que puede ir en un inicio:
--                      su nombre, de que modulo es y la funcion que le da sus
--                      datos.
--                        module_id  NULL = General (de todos: la suscripcion,
--                                   la actividad reciente...). Con modulo, solo
--                                   la ve la empresa que lo tiene contratado.
--                        fn         la funcion que le da datos y dice como se
--                                   ve: una de HomeLayout::FUNCTIONS
--                                   (app/home/mdl/mdl-home-layout.php). Varias
--                                   tarjetas pueden usar la misma.
--                      Despues de esta siembra, las tarjetas se dan de alta,
--                      se editan y se borran en Developer › Accesos › Inicio.
--                      Una FUNCION nueva si es codigo: HomeLayout::FUNCTIONS,
--                      HomeWidgets (app/home/ctrl/widgets-home.php) y home.js.
--                        zone       donde cae al agregarla: top (arriba, ancho
--                                   completo), main (columna principal) o side
--                                   (columna lateral).
--                        zones      donde se le deja estar (una tabla no cabe en
--                                   la columna lateral).
--                        is_default sale en el inicio de quien no lo ha
--                                   personalizado.
--                        route      a donde lleva su «Ver más» (relativa a pro/).
--
--   user_home_widgets  EL ACOMODO de cada dueño, por empresa: que tarjetas, en
--                      que zona y en que orden. Sin filas = el de fabrica
--                      (is_default, en el orden del catalogo).
--
-- Solo crea y siembra. Busca por code: se puede volver a correr.
-- =============================================================================

CREATE TABLE IF NOT EXISTS home_widgets (
    id          INT          NOT NULL AUTO_INCREMENT,
    code        VARCHAR(60)  NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(255) NULL,
    icon        VARCHAR(40)  NULL,
    module_id   INT          NULL COMMENT 'NULL = General: de todos los modulos',
    fn          VARCHAR(60)  NOT NULL COMMENT 'funcion de HomeWidgets que arma sus datos',
    zone        ENUM('top', 'main', 'side') NOT NULL DEFAULT 'main' COMMENT 'donde cae al agregarla',
    zones       VARCHAR(20)  NOT NULL DEFAULT 'top,main,side' COMMENT 'donde se le deja estar',
    route       VARCHAR(160) NULL COMMENT 'Ver mas: ruta relativa a pro/',
    orden       SMALLINT     NULL,
    is_default  TINYINT      NOT NULL DEFAULT 0,
    is_active   TINYINT      NOT NULL DEFAULT 1,
    created_at  DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_home_widgets_code (code),
    KEY ix_home_widgets_module (module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_home_widgets (
    id          INT      NOT NULL AUTO_INCREMENT,
    user_id     INT      NOT NULL,
    company_id  INT      NOT NULL,
    widget_id   INT      NOT NULL,
    zone        ENUM('top', 'main', 'side') NOT NULL,
    orden       SMALLINT NOT NULL,
    created_at  DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_home_widget (user_id, company_id, widget_id),
    KEY ix_user_home (user_id, company_id),
    CONSTRAINT fk_user_home_widget FOREIGN KEY (widget_id) REFERENCES home_widgets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- El catalogo. module = NULL es General; si no, el code del modulo.
-- El orden de fabrica reproduce el inicio de siempre: las cifras arriba; la
-- atencion, los modulos, las sucursales y la actividad al centro; la
-- suscripcion y los festejos a un lado.
-- -----------------------------------------------------------------------------
INSERT INTO home_widgets (code, name, description, icon, module_id, fn, zone, zones, route, orden, is_default, is_active, created_at)
SELECT x.code, x.name, x.description, x.icon, m.id, x.fn, x.zone, x.zones, x.route, x.orden, x.is_default, 1, NOW()
FROM (
              SELECT 'ventas-hoy' AS code, 'Ventas de hoy' AS name, 'Vendido, cobrado, tickets y entregas de hoy, contra el mismo día de la semana pasada.' AS description, 'trending-up' AS icon, 'pedidos' AS module, 'ventasHoy' AS fn, 'top' AS zone, 'top,main' AS zones, 'app/order/dashboard.php' AS route, 10 AS orden, 1 AS is_default
    UNION ALL SELECT 'atencion', 'Requiere tu atención', 'Lo que tienes que saber o mandar hacer hoy: entregas, saldos, cierres pendientes.', 'bell-ring', NULL, 'atencion', 'main', 'top,main,side', NULL, 20, 1
    UNION ALL SELECT 'suscripcion', 'Tu suscripción', 'Tu plan, su estado y la fecha de tu próximo pago.', 'badge-check', NULL, 'suscripcion', 'side', 'main,side', 'app/configuracion/#pagos', 30, 1
    UNION ALL SELECT 'modulos', 'Tus módulos', 'Accesos directos a los módulos de tu plan.', 'layout-grid', NULL, 'modulos', 'main', 'top,main', NULL, 40, 1
    UNION ALL SELECT 'cumpleanos', 'Cumpleaños del mes', 'Quién de tu equipo cumple años este mes, para felicitarlo.', 'cake', 'capital-humano', 'cumpleanos', 'side', 'main,side', NULL, 50, 1
    UNION ALL SELECT 'ventas-sucursal', 'Hoy por sucursal', 'Lo vendido, lo cobrado y cómo está la caja de cada sucursal hoy.', 'store', 'pedidos', 'ventasSucursal', 'main', 'top,main', 'app/order/cortes.php', 60, 1
    UNION ALL SELECT 'aniversarios', 'Aniversarios laborales', 'Quién cumple años en tu empresa este mes, para darle un detalle.', 'party-popper', 'capital-humano', 'aniversarios', 'side', 'main,side', NULL, 70, 1
    UNION ALL SELECT 'actividad', 'Actividad reciente', 'Lo último que pasó en tu empresa, en cualquier sucursal.', 'activity', NULL, 'actividad', 'main', 'top,main,side', NULL, 80, 1
    UNION ALL SELECT 'ventas-dias', 'Ventas de las últimas 2 semanas', 'Cuánto vendiste cada día de los últimos 14 días.', 'chart-column', 'pedidos', 'ventasDias', 'main', 'top,main,side', 'app/order/dashboard.php', 90, 0
    UNION ALL SELECT 'top-productos', 'Top 10 productos', 'Los 10 productos de tu catálogo que más vendiste este mes, por importe y con sus piezas.', 'trophy', 'pedidos', 'topProductos', 'side', 'main,side', 'app/catalogo/catalogo.php', 100, 0
    UNION ALL SELECT 'top-clientes', 'Mejores clientes','Los 5 clientes que más te compraron este mes.', 'crown', 'pedidos', 'topClientes', 'side', 'main,side', 'app/order/clientes.php', 110, 0
    UNION ALL SELECT 'entregas', 'Próximas entregas', 'Los pedidos que salen hoy, mañana y pasado, con su saldo.', 'truck', 'pedidos', 'entregas', 'main', 'top,main,side', 'app/order/calendario.php', 120, 0
    UNION ALL SELECT 'ingresos', 'Nuevos ingresos del mes', 'Quién se integró a tu equipo este mes.', 'user-plus', 'capital-humano', 'ingresos', 'side', 'main,side', NULL, 130, 0
    UNION ALL SELECT 'lealtad-mes', 'Lealtad este mes', 'Tarjetas activas, las nuevas del mes y cuánto se vendió con tarjeta.', 'heart-handshake', 'lealtad', 'lealtadMes', 'side', 'main,side', 'app/lealtad/tarjetas.php', 140, 0
) x
LEFT JOIN modules m ON m.code = x.module
WHERE (x.module IS NULL OR m.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM home_widgets w WHERE w.code = x.code);

-- Comprobacion: el catalogo con su modulo.
SELECT w.orden, w.code, w.name, COALESCE(m.name, 'General') AS modulo, w.fn, w.zone, w.zones, w.is_default
FROM home_widgets w
LEFT JOIN modules m ON m.id = w.module_id
ORDER BY w.orden, w.id;
