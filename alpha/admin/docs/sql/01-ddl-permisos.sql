USE fayxzvov_alpha;

CREATE TABLE IF NOT EXISTS usr_permissions (
    code          VARCHAR(60)  NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   VARCHAR(255) NULL,
    family        VARCHAR(60)  NOT NULL,
    is_dangerous  SMALLINT     NOT NULL DEFAULT 0,
    has_scope     SMALLINT     NOT NULL DEFAULT 0,
    sort          SMALLINT     NOT NULL DEFAULT 0,
    active        SMALLINT     NOT NULL DEFAULT 1,
    date_creation DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id            INT AUTO_INCREMENT PRIMARY KEY,
    UNIQUE KEY uq_permission_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS usr_rol_permissions (
    scope          ENUM('own','all') NOT NULL DEFAULT 'all',
    active         SMALLINT NOT NULL DEFAULT 1,
    date_creation  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usr_rols_id    INT NOT NULL,
    permissions_id INT NOT NULL,
    id             INT AUTO_INCREMENT PRIMARY KEY,
    UNIQUE KEY uq_rol_permission (usr_rols_id, permissions_id),
    KEY idx_rol (usr_rols_id),
    CONSTRAINT fk_rolperm_rol  FOREIGN KEY (usr_rols_id)    REFERENCES usr_rols(id),
    CONSTRAINT fk_rolperm_perm FOREIGN KEY (permissions_id) REFERENCES usr_permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO usr_permissions (code, name, description, family, is_dangerous, has_scope, sort) VALUES
('view_order',          'Ver pedidos',                 'Consultar el listado y el detalle de un pedido',              'Pedidos',    0, 1, 10),
('create_order',        'Crear pedido',                'Levantar un pedido nuevo',                                    'Pedidos',    0, 1, 20),
('edit_order',          'Editar pedido',               'Cambiar datos y partidas de un pedido en armado',             'Pedidos',    0, 1, 30),
('edit_paid_order',     'Editar pedido liquidado',     'Un pedido ya pagado por completo. Pide contrasena',           'Pedidos',    0, 0, 40),
('delete_blocked_line', 'Eliminar partida bloqueada',  'De un dia anterior o de un pedido liquidado. Pide motivo',    'Pedidos',    0, 0, 50),
('delete_order',        'Eliminar pedido',             'Borra el pedido y todas sus partidas',                        'Pedidos',    1, 0, 60),
('register_payment',    'Registrar pago',              'Cobrar un abono sobre un pedido',                             'Pagos',      0, 1, 10),
('edit_payment_method', 'Cambiar metodo de un cobro',  'Solo mientras el corte de ese pago siga abierto',             'Pagos',      0, 0, 20),
('delete_payment',      'Eliminar pago',               'Afecta el corte del dia de la sucursal que cobro',            'Pagos',      1, 0, 30),
('edit_discount',       'Editar descuento',            'Cambiar el descuento aplicado a un pedido',                   'Descuentos y entregas', 1, 0, 10),
('delete_discount',     'Eliminar descuento',          'Quitar el descuento y devolver el pedido a su total',         'Descuentos y entregas', 0, 0, 20),
('edit_delivery',       'Editar datos de entrega',     'Fecha, hora y direccion de entrega',                          'Descuentos y entregas', 0, 0, 30),
('manage_shift',        'Abrir y consultar turnos',    'Ver el estado de caja y abrir turno',                          'Turnos y cierre', 0, 1, 10),
('view_pending_cierre', 'Ver corte del dia pendiente', 'Consultar el corte Z antes de cerrarlo',                      'Turnos y cierre', 0, 0, 20),
('close_day',           'Cerrar y reabrir el dia',     'Cierra el corte Z de la sucursal. Reabrirlo lo recalcula',    'Turnos y cierre', 1, 1, 30),
('recalc_shift',        'Recalcular un turno',         'Rehace los totales de un turno ya cerrado',                   'Turnos y cierre', 1, 0, 40),
('switch_subsidiary',   'Elegir sucursal en la barra', 'El selector de sucursal de la navbar',                        'Alcance',    0, 0, 10);
