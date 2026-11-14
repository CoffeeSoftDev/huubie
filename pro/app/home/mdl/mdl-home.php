<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  Lo que enseña el inicio de una empresa. Todo se pide por company_id: nada
    de aqui cruza de una empresa a otra.

    Las personas salen de employees (Capital Humano) y no de users: el equipo
    de una empresa incluye a quien no tiene cuenta. El nombre es el de su
    cuenta cuando la tiene y employees.full_name cuando no. */
class mdl extends CRUD {
    public $util;
    public $bd;

    // Como se nombra a un empleado, tenga cuenta o no.
    const EMPLOYEE_NAME = "TRIM(COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''), e.full_name, ''))";

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getCompanyById($array) {
        $query = "
            SELECT
                c.id,
                c.name,
                c.ubication,
                c.rfc,
                c.logo,
                c.status,
                (SELECT COUNT(*) FROM {$this->bd}branches b WHERE b.company_id = c.id AND b.is_active = 1)     AS branches,
                (SELECT COUNT(*) FROM {$this->bd}users u    WHERE u.company_id = c.id AND u.status = 'active') AS users
            FROM {$this->bd}companies c
            WHERE c.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function getUserById($array) {
        $query = "
            SELECT u.id, u.name, u.last_name, u.email, u.photo, u.color
            FROM {$this->bd}users u
            WHERE u.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // A quien acudir dentro de la empresa: su dueño.
    function getOwnerByCompany($array) {
        $query = "
            SELECT
                u.id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS name,
                u.email,
                u.photo,
                u.color,
                e.phone
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}employees e ON e.user_id = u.id
            WHERE u.company_id = ? AND u.is_owner = 1 AND u.status = 'active'
            ORDER BY u.id ASC
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // Cumpleaños del mes en curso, por dia. El mes lo pone MySQL con su reloj.
    function listBirthdaysByCompany($array) {
        $query = "
            SELECT
                " . self::EMPLOYEE_NAME . " AS name,
                u.photo,
                u.color,
                DAY(e.birth_date) AS day,
                (DAY(e.birth_date) = DAY(CURDATE())) AS today
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u ON u.id = e.user_id
            WHERE e.company_id = ?
              AND e.birth_date IS NOT NULL
              AND MONTH(e.birth_date) = MONTH(CURDATE())
              AND (u.id IS NULL OR u.status = 'active')
            ORDER BY DAY(e.birth_date) ASC
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // Aniversarios de ingreso del mes: quien cumple al menos un año.
    function listAnniversariesByCompany($array) {
        $query = "
            SELECT
                " . self::EMPLOYEE_NAME . " AS name,
                u.photo,
                u.color,
                DAY(e.hire_date) AS day,
                (YEAR(CURDATE()) - YEAR(e.hire_date)) AS years
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u ON u.id = e.user_id
            WHERE e.company_id = ?
              AND e.hire_date IS NOT NULL
              AND MONTH(e.hire_date) = MONTH(CURDATE())
              AND YEAR(e.hire_date) < YEAR(CURDATE())
              AND (u.id IS NULL OR u.status = 'active')
            ORDER BY DAY(e.hire_date) ASC
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [subscription_id]. Lo que suma un plan Personalizado, al precio contratado.
    function getSubscriptionTotal($array) {
        $query = "SELECT SUM(price) AS total FROM {$this->bd}subscription_module WHERE subscription_id = ?";

        $sql = $this->_Read($query, $array);
        return empty($sql) || $sql[0]['total'] === null ? null : (float) $sql[0]['total'];
    }

    /*  EL NEGOCIO DE HOY (inicio del dueño). Sale de fayxzvov_pos, la base de
        Punto de venta (app/order/mdl/mdl-order.php), con sus mismas reglas:
        vendido = ventas y pedidos pendientes o pagados (2 y 3), en el dia en
        que se capturaron; cobrado = pagos vivos que entraron ese dia; un NULL
        en active cuenta como activo. Todo va por sucursal ACTIVA de la
        empresa: el dueño ve todas, no solo la de su sesion. */
    const POS = 'fayxzvov_pos.';

    const IN_COMPANY = "INNER JOIN branches b ON b.company_id = ? AND b.is_active = 1 AND b.id = ";

    function listBranchesByCompany($array) {
        $sql = $this->_Read("SELECT id, name FROM {$this->bd}branches WHERE company_id = ? AND is_active = 1 ORDER BY id", $array);
        return is_array($sql) ? $sql : [];
    }

    // [company_id, desde, hasta). Tickets y lo vendido, por sucursal.
    function listSalesByBranch($array) {
        $query = "
            SELECT s.branch_id, COUNT(*) AS tickets, IFNULL(SUM(s.total), 0) AS sold
            FROM " . self::POS . "sale s
            " . self::IN_COMPANY . "s.branch_id
            WHERE s.sale_status_id IN (2, 3)
              AND IFNULL(s.active, 1) = 1
              AND s.created_at >= ? AND s.created_at < ?
            GROUP BY s.branch_id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [company_id, desde, hasta). Lo que entro a caja, por sucursal. Un pago
    // sin sucursal cuenta en la de su pedido.
    function listPaidByBranch($array) {
        $query = "
            SELECT b.id AS branch_id, IFNULL(SUM(p.amount), 0) AS paid
            FROM " . self::POS . "payment p
            LEFT JOIN " . self::POS . "sale s ON s.id = p.sale_id
            " . self::IN_COMPANY . "IFNULL(p.branch_id, s.branch_id)
            WHERE IFNULL(p.active, 1) = 1
              AND p.deleted_at IS NULL
              AND IFNULL(p.paid_at, p.created_at) >= ? AND IFNULL(p.paid_at, p.created_at) < ?
            GROUP BY b.id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    /*  [company_id, desde, hasta] por fecha de ENTREGA. Pedidos del rango, los
        que faltan por entregar (todo lo que no esta entregado: sin entregar o
        en produccion) y, de esos, cuantos traen saldo y cuanto suman. */
    function listDeliveriesByBranch($array) {
        $query = "
            SELECT
                x.branch_id,
                COUNT(*)                                                  AS total,
                IFNULL(SUM(x.pending), 0)                                 AS pending,
                IFNULL(SUM(IF(x.pending = 1 AND x.total - x.paid > 0.004, 1, 0)), 0) AS due_orders,
                IFNULL(SUM(IF(x.pending = 1, GREATEST(x.total - x.paid, 0), 0)), 0)  AS due
            FROM (
                SELECT
                    s.branch_id,
                    s.total,
                    IF(IFNULL(s.delivery_status, 0) <> 1, 1, 0) AS pending,
                    (SELECT IFNULL(SUM(p.amount), 0)
                       FROM " . self::POS . "payment p
                      WHERE p.sale_id = s.id AND IFNULL(p.active, 1) = 1 AND p.deleted_at IS NULL) AS paid
                FROM " . self::POS . "sale s
                " . self::IN_COMPANY . "s.branch_id
                WHERE s.sale_type_id = 1
                  AND s.sale_status_id IN (2, 3)
                  AND IFNULL(s.active, 1) = 1
                  AND s.delivery_date BETWEEN ? AND ?
            ) x
            GROUP BY x.branch_id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [company_id]. Desde que dia tiene turno abierto cada sucursal.
    function listOpenTurnsByBranch($array) {
        $query = "
            SELECT t.branch_id, MIN(DATE(IFNULL(t.opened_at, t.created_at))) AS since
            FROM " . self::POS . "turn t
            " . self::IN_COMPANY . "t.branch_id
            WHERE t.status = 'open' AND IFNULL(t.active, 1) = 1
            GROUP BY t.branch_id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [company_id, desde, hasta). Dias con turnos y sin cierre del dia vigente.
    function listUnclosedDaysByBranch($array) {
        $query = "
            SELECT t.branch_id, COUNT(DISTINCT DATE(IFNULL(t.opened_at, t.created_at))) AS days
            FROM " . self::POS . "turn t
            " . self::IN_COMPANY . "t.branch_id
            WHERE IFNULL(t.active, 1) = 1
              AND IFNULL(t.opened_at, t.created_at) >= ? AND IFNULL(t.opened_at, t.created_at) < ?
              AND NOT EXISTS (
                    SELECT 1
                    FROM " . self::POS . "daily_closure d
                    WHERE d.branch_id = t.branch_id
                      AND DATE(d.closure_date) = DATE(IFNULL(t.opened_at, t.created_at))
                      AND d.reopened_at IS NULL
                      AND IFNULL(d.active, 1) = 1
              )
            GROUP BY t.branch_id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [company_id]. Lo ultimo que paso con los pedidos y ventas de la empresa.
    function listActivityByCompany($array) {
        $query = "
            SELECT
                h.type,
                IFNULL(h.action, '') AS action,
                h.created_at,
                s.folio,
                b.name AS branch,
                TRIM(CONCAT_WS(' ', u.name, u.last_name)) AS user
            FROM " . self::POS . "history_log h
            INNER JOIN " . self::POS . "sale s ON s.id = h.sale_id
            " . self::IN_COMPANY . "s.branch_id
            LEFT JOIN {$this->bd}users u ON u.id = h.user_id
            WHERE IFNULL(h.active, 1) = 1
            ORDER BY h.id DESC
            LIMIT 6
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }
}
?>
