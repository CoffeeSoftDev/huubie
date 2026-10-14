USE fayxzvov_alpha;

-- Avisos de WhatsApp (pestaña WhatsApp del admin). Todo cuelga de la empresa: alpha
-- atiende a varias (Marinni, Club Campestre, Terraza, Reginas) y cada una lleva su
-- propio proveedor, sus números y sus textos.

-- Una fila por proveedor y empresa; `active` marca el que envía. Guardar las dos
-- filas evita recapturar las llaves al volver a un proveedor ya configurado.
-- `state` y `checked_at` son el resultado de la última prueba de conexión.
CREATE TABLE IF NOT EXISTS wa_config (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    provider     VARCHAR(20)  NOT NULL,
    instance     VARCHAR(100) NULL,
    token        VARCHAR(255) NULL,
    api_url      VARCHAR(255) NULL,
    state        VARCHAR(40)  NULL,
    checked_at   DATETIME     NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    companies_id INT          NOT NULL,
    active       TINYINT      NOT NULL DEFAULT 0,
    UNIQUE KEY uq_wa_config_provider (companies_id, provider),
    KEY companies_id (companies_id),
    CONSTRAINT wa_config_ibfk_1 FOREIGN KEY (companies_id)
        REFERENCES fayxzvov_admin.companies (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- phone: 10 dígitos o id de grupo (…@g.us), nunca con lada: la lada la pone el
-- proveedor al enviar. type: 'cierre' | 'turno' | 'personalizado'.
-- `active` = 0 es pausa (el número no recibe, pero no se pierde).
CREATE TABLE IF NOT EXISTS wa_destinatarios (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(60)  NOT NULL,
    type         VARCHAR(20)  NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    companies_id INT          NOT NULL,
    active       TINYINT      NOT NULL DEFAULT 1,
    UNIQUE KEY uq_wa_destinatario (companies_id, type, phone),
    KEY companies_id (companies_id),
    CONSTRAINT wa_destinatarios_ibfk_1 FOREIGN KEY (companies_id)
        REFERENCES fayxzvov_admin.companies (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Una fila por aviso. `active` = 0 pausa el aviso completo sin tocar a sus
-- destinatarios (el interruptor de cada tarjeta en Destinatarios).
CREATE TABLE IF NOT EXISTS wa_plantillas (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type         VARCHAR(20)  NOT NULL,
    body         TEXT         NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    companies_id INT          NOT NULL,
    active       TINYINT      NOT NULL DEFAULT 1,
    UNIQUE KEY uq_wa_plantilla (companies_id, type),
    KEY companies_id (companies_id),
    CONSTRAINT wa_plantillas_ibfk_1 FOREIGN KEY (companies_id)
        REFERENCES fayxzvov_admin.companies (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Bitácora que llena _Message.php al enviar. recipients guarda los números tal como
-- salieron (texto), así que borrar un destinatario no rompe el historial.
-- status: 'enviado' | 'fallido'. reference: "Corte Z", "Turno de Ana", "Pedido #128".
CREATE TABLE IF NOT EXISTS wa_historial (
    id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type            VARCHAR(20)  NOT NULL,
    reference       VARCHAR(150) NULL,
    recipients      TEXT         NOT NULL,
    provider        VARCHAR(20)  NOT NULL,
    error           VARCHAR(255) NULL,
    sent_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status          VARCHAR(20)  NOT NULL,
    subsidiaries_id INT          NULL,
    companies_id    INT          NOT NULL,
    KEY subsidiaries_id (subsidiaries_id),
    KEY companies_id (companies_id),
    KEY idx_wa_historial_sent (companies_id, sent_at),
    CONSTRAINT wa_historial_ibfk_1 FOREIGN KEY (subsidiaries_id)
        REFERENCES subsidiaries (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT wa_historial_ibfk_2 FOREIGN KEY (companies_id)
        REFERENCES fayxzvov_admin.companies (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Migración inicial: lo que hoy vive en constantes. Solo Pastelería Reginas
-- (companies_id 4) usa pedidos, así que solo ella hereda la configuración actual.
-- El token NO va en este archivo: se captura una vez en Configuración > WhatsApp >
-- Credenciales API (el valor vigente está en Message::TOKEN de conf/_Message.php).
INSERT IGNORE INTO wa_config (provider, instance, companies_id, active)
VALUES ('ultramsg', 'instance50238', 4, 1);

-- Número de WHATSAPP_CIERRE (ctrl-cierre.php) y WHATSAPP_TURNO (ctrl-pedidos.php).
INSERT IGNORE INTO wa_destinatarios (name, phone, type, companies_id, active) VALUES
('Gerente', '9621501886', 'cierre', 4, 1),
('Gerente', '9621501886', 'turno',  4, 1);

-- Los textos son los mismos que hoy arman notifyDailyClosed() y notifyShiftClosed().
-- El aviso de Pedidos (clave 'personalizado': normales y personalizados, al terminar
-- el pedido) nace pausado: nadie lo recibe todavía.
INSERT IGNORE INTO wa_plantillas (type, body, companies_id, active) VALUES
('cierre', '*CIERRE DEL DIA*\n{sucursal} - {fecha}\nCerro: {cajero}\n\n*Ventas:* ${ventas}\nEfectivo: ${efectivo}\nTarjeta: ${tarjeta}\nTransferencia: ${transferencia}\nDescuentos: ${descuentos}\nPedidos: {pedidos}\nTurnos: {turnos}', 4, 1),
('turno', '*CORTE DE TURNO*\n{sucursal} - {cajero}\n\n*Ventas:* ${ventas}\nEfectivo: ${efectivo}\nTarjeta: ${tarjeta}\nTransferencia: ${transferencia}\nPedidos: {pedidos}', 4, 1),
('personalizado', '🎂 *PEDIDO #{folio}*\n📅 Fecha: {fecha}\n⏰ Hora: {hora}\n📍 Sucursal: {sucursal}\n👤 Cliente: {cliente}\n📱 Tel: {telefono}\n\n*PRODUCTOS*\n{productos}\n\n*ESTATUS:* {estatus}', 4, 0);
