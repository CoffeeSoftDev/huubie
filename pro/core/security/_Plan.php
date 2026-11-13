<?php
/*  LO QUE CONTRATO LA EMPRESA.

    Dos preguntas, y las dos se contestan con la empresa de la sesion:

      1. ¿Puede operar?  Plan::state()['ok']
         Solo una empresa ACTIVA (companies.status) con una suscripcion al
         corriente: active, o trial DENTRO de su periodo de prueba. Las demas
         entran, ven su inicio y ahi se les pide el pago; ningun modulo les
         abre.

         LA PRUEBA CADUCA. Termina al cierre del dia de subscriptions.ends_at
         (ese dia todavia se trabaja). Una prueba sin fecha -- las que se
         capturaron antes de esta regla -- toma la de su inicio mas los dias de
         prueba del plan (plans.trial_days, o TRIAL_DAYS). Al vencer no se
         borra ni se cambia nada: la empresa pasa a "solo inicio" hasta que
         paga y su suscripcion se vuelve active. El estado NO se reescribe
         aqui: se calcula con la fecha en cada peticion, asi que no depende de
         un cron que un dia no corra.

      2. ¿Que modulos tiene?  Plan::modules()
         Los de su plan, segun plans.modules_mode:
           included       los de plan_module
           all            todos los que se venden
           custom, pick   los que eligio: subscription_module

    Lo usan _Permission (la puerta de cada pagina y cada ctrl), el rail y el
    inicio, asi que lo que se ve en el menu y lo que deja entrar no pueden
    discrepar.

    Developer queda fuera de todo esto: no se vende, es la administracion de la
    plataforma y su acceso lo decide el rol.

    root sin empresa elegida (company_id = 0) no tiene plan que revisar. En
    cuanto entra a una, la ve como su dueño: con el plan y el estado de ESA
    empresa. */
require_once __DIR__ . '/../database/_CRUD.php';
require_once __DIR__ . '/_Session.php';

class Plan extends CRUD {
    // Modulos que no dependen del plan.
    const FREE = ['developer'];

    // Suscripciones con las que se puede trabajar (la prueba, mientras dure).
    const SUB_OK = ['active', 'trial'];

    // Dias de prueba cuando el plan no dice cuantos.
    const TRIAL_DAYS = 14;

    /*  Cuando termina la prueba de una suscripcion (alias s) de un plan
        (alias p), como expresion SQL. La usan state() y la lista de Empresas:
        la regla vive en un solo sitio. */
    static function trialEndSql($s = 's', $p = 'p') {
        return "DATE(COALESCE({$s}.ends_at, DATE_ADD(COALESCE({$s}.starts_at, {$s}.created_at, NOW()), INTERVAL COALESCE(NULLIF({$p}.trial_days, 0), " . self::TRIAL_DAYS . ") DAY)))";
    }

    private static $db      = null;
    private static $state   = null;
    private static $modules = null;

    private static function db() {
        if (self::$db === null) self::$db = new self;
        return self::$db;
    }

    static function companyId() {
        return (int) ($_SESSION['company_id'] ?? 0);
    }

    /*  El estado de la empresa de la sesion. Una consulta por peticion.

        reason dice por que no puede operar, y es lo que el inicio traduce en
        su aviso: company (la empresa no esta activa), none (sin plan),
        trial (la prueba termino), subscription (el pago no esta al corriente).

        En prueba, sub.trial_end es su ultimo dia y sub.trial_left los dias que
        le quedan sin contar hoy (0 = hoy es el ultimo). */
    static function state() {
        if (self::$state !== null) return self::$state;

        $companyId = self::companyId();

        if ($companyId === 0) {
            return self::$state = ['ok' => !empty($_SESSION['is_root']), 'reason' => 'none', 'company_status' => null, 'sub' => null];
        }

        $sql = self::db()->_Read("
            SELECT
                c.status AS company_status,
                s.id     AS sub_id,
                s.status AS sub_status,
                s.ends_at,
                s.next_billing_date,
                " . self::trialEndSql() . " AS trial_end,
                DATEDIFF(" . self::trialEndSql() . ", CURDATE()) AS trial_left,
                p.id     AS plan_id,
                p.name   AS plan,
                p.price,
                p.currency,
                p.billing_cycle,
                p.modules_mode
            FROM companies c
            LEFT JOIN subscriptions s ON s.id = (
                SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.company_id = c.id
            )
            LEFT JOIN plans p ON p.id = s.plan_id
            WHERE c.id = ?
            LIMIT 1
        ", [$companyId]);

        $row = empty($sql) ? null : $sql[0];

        if (!$row) {
            return self::$state = ['ok' => false, 'reason' => 'company', 'company_status' => null, 'sub' => null];
        }

        $trial = $row['sub_status'] === 'trial';

        $sub = $row['sub_id'] === null ? null : [
            'id'      => (int) $row['sub_id'],
            'status'  => $row['sub_status'],
            'trial_end'  => $trial ? $row['trial_end'] : null,
            'trial_left' => $trial ? (int) $row['trial_left'] : null,
            'ends_at' => $row['ends_at'],
            'next'    => $row['next_billing_date'],
            'plan_id' => (int) $row['plan_id'],
            'plan'    => $row['plan'],
            'price'   => $row['price'] === null ? null : (float) $row['price'],
            'currency'=> $row['currency'] ?: 'MXN',
            'cycle'   => $row['billing_cycle'] ?: 'monthly',
            'mode'    => $row['modules_mode'],
        ];

        $reason = '';
        if ($row['company_status'] !== 'active')                       $reason = 'company';
        elseif ($sub === null)                                         $reason = 'none';
        elseif (!in_array($sub['status'], self::SUB_OK, true))         $reason = 'subscription';
        elseif ($trial && $sub['trial_left'] < 0)                      $reason = 'trial';

        return self::$state = [
            'ok'             => $reason === '',
            'reason'         => $reason,
            'company_status' => $row['company_status'],
            'sub'            => $sub,
        ];
    }

    /*  Los modulos contratados, en el orden del menu. Se listan aunque la
        empresa no pueda operar: el inicio los enseña bloqueados, para que se
        vea que es lo que se recupera al pagar. */
    static function modules() {
        if (self::$modules !== null) return self::$modules;

        $sub = self::state()['sub'];
        if ($sub === null) return self::$modules = [];

        $base = "
            SELECT m.id, m.name, m.code, m.icon, m.description, m.route
            FROM modules m
        ";
        $sellable = "m.is_active = 1 AND (m.code IS NULL OR m.code NOT IN ('" . implode("','", self::FREE) . "'))";
        $order    = " ORDER BY m.orden IS NULL, m.orden, m.name";

        if ($sub['mode'] === 'all') {
            $sql = self::db()->_Read($base . " WHERE {$sellable}" . $order);
        } elseif ($sub['mode'] === 'included') {
            $sql = self::db()->_Read($base . "
                INNER JOIN plan_module pm ON pm.module_id = m.id AND pm.plan_id = ?
                WHERE {$sellable}" . $order, [$sub['plan_id']]);
        } else {
            $sql = self::db()->_Read($base . "
                INNER JOIN subscription_module sm ON sm.module_id = m.id AND sm.subscription_id = ?
                WHERE {$sellable}" . $order, [$sub['id']]);
        }

        return self::$modules = is_array($sql) ? $sql : [];
    }

    // ¿Se puede usar este modulo ahora mismo? Contratado Y empresa al corriente.
    static function allows($moduleId, $moduleCode) {
        if (in_array((string) $moduleCode, self::FREE, true)) return true;

        // root que aun no elige empresa: no hay plan contra que comparar.
        if (self::companyId() === 0) return !empty($_SESSION['is_root']);

        if (!self::state()['ok']) return false;

        foreach (self::modules() as $module) {
            if ((int) $module['id'] === (int) $moduleId) return true;
        }

        return false;
    }
}
?>
