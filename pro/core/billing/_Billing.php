<?php
/*  EL COBRO DE UNA SUSCRIPCION, de punta a punta.

      checkout()    manda a pagar: crea la sesion de Stripe Checkout de una
                    suscripcion nuestra y devuelve su URL.
      reconcile()   la pagina de regreso: pregunta a Stripe por esa sesion y,
                    si esta pagada, activa.
      handle()      el webhook: lo mismo, mas las renovaciones, los cobros que
                    fallan y las cancelaciones.
      changePrice() cambio de plan: lo que se cobra desde la siguiente factura.

    El mismo pago llega por dos caminos -- el navegador que regresa y el
    webhook -- y no se sabe cual primero, ni si alguno llega. Por eso los dos
    acaban en activate(), que se puede llamar las veces que sea: el pago se
    guarda una vez (payment_history.stripe_id es unica) y el correo de
    bienvenida sale una vez (stripe_events).

    Nada de lo que decide un cobro viene del navegador: el id de la sesion solo
    sirve para preguntarle a Stripe, con nuestra llave, que pago y de quien
    (metadata.subscription_id, que pusimos nosotros al crearla).

    El precio se manda en linea (price_data) y no como un Price guardado en
    Stripe: los planes viven en Facturacion y un Personalizado cuesta lo que
    sumen sus modulos, asi que no hay catalogo que mantener en dos sitios.
    Los precios son sin IVA: se agrega como impuesto aparte (IVA 16 %). */
require_once __DIR__ . '/../database/_CRUD.php';
require_once __DIR__ . '/../helpers/_Message.php';
require_once __DIR__ . '/_Stripe.php';

class Billing extends CRUD {
    const IVA = 16;

    const INTERVALS = ['monthly' => 'month', 'yearly' => 'year'];

    // La URL de pro/, para los enlaces de regreso y el del correo.
    public $url;

    /*  $where: los dirname() del script que corre a pro/ (ver proUrl()), o la
        URL de pro/ ya armada cuando quien cobra no vive dentro de pro/ (la
        pagina de CoffeeSoft, que lleva su propia copia de este archivo). */
    function __construct($where) {
        $this->url = is_int($where) ? self::proUrl($where) : rtrim((string) $where, '/') . '/';
    }

    /*  La URL de pro/ vista desde el script que corre. $levels son los
        dirname() que hay de ese script a pro/: 1 desde pro/x.php, 3 desde
        api/ctrl/, 4 desde app/<modulo>/ctrl/. */
    static function proUrl($levels) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
              || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
              || (($_SERVER['SERVER_PORT'] ?? '') == 443);

        $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '', $levels)), '/');

        return ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $path . '/';
    }

    // La suscripcion con lo que hace falta para cobrarla: empresa, plan, a
    // quien se le cobra (el dueño) y cuanto.
    function subscription($id) {
        $sql = $this->_Read("
            SELECT
                s.id, s.status, s.company_id, s.stripe_subscription_id,
                c.name AS company, c.status AS company_status, c.stripe_customer_id,
                p.name AS plan, p.price, p.currency, p.billing_cycle, p.modules_mode,
                (SELECT SUM(sm.price) FROM subscription_module sm WHERE sm.subscription_id = s.id) AS modules_price,
                (
                    SELECT GROUP_CONCAT(m.name ORDER BY m.orden, m.name SEPARATOR ', ')
                    FROM subscription_module sm
                    INNER JOIN modules m ON m.id = sm.module_id
                    WHERE sm.subscription_id = s.id
                ) AS modules,
                (
                    SELECT u.email FROM users u
                    WHERE u.company_id = s.company_id AND u.is_owner = 1 AND u.status = 'active'
                    ORDER BY u.id LIMIT 1
                ) AS owner_email,
                (
                    SELECT u.name FROM users u
                    WHERE u.company_id = s.company_id AND u.is_owner = 1 AND u.status = 'active'
                    ORDER BY u.id LIMIT 1
                ) AS owner_name
            FROM subscriptions s
            INNER JOIN companies c ON c.id = s.company_id
            INNER JOIN plans p     ON p.id = s.plan_id
            WHERE s.id = ?
            LIMIT 1
        ", [(int) $id]);

        return empty($sql) ? null : $sql[0];
    }

    // La que manda en una empresa: la ultima.
    function currentSubscriptionId($companyId) {
        $sql = $this->_Read("SELECT MAX(id) AS id FROM subscriptions WHERE company_id = ?", [(int) $companyId]);
        return empty($sql) ? 0 : (int) $sql[0]['id'];
    }

    // Lo que cuesta, sin IVA: el precio del plan o, en un Personalizado, la
    // suma de sus modulos al precio con que se contrataron.
    function amount($sub) {
        if ($sub['modules_mode'] === 'custom') return (float) $sub['modules_price'];
        return $sub['price'] === null ? 0.0 : (float) $sub['price'];
    }

    /*  Devuelve [url, error]. $success lleva {CHECKOUT_SESSION_ID} tal cual:
        Stripe lo cambia por el id de la sesion al regresar. */
    function checkout($subscriptionId, $success, $cancel) {
        $sub = $this->subscription($subscriptionId);

        if (!$sub)                       return [null, 'No encontramos tu suscripción.'];
        if ($sub['status'] === 'active') return [null, 'Tu plan ya está activo.'];

        $amount = $this->amount($sub);
        if ($amount <= 0) return [null, 'Tu plan no tiene un precio para cobrar en línea. Contáctanos.'];

        $currency = strtolower($sub['currency'] ?: 'MXN');
        $interval = self::INTERVALS[$sub['billing_cycle']] ?? null;   // null = pago unico

        $price = [
            'currency'     => $currency,
            'unit_amount'  => (int) round($amount * 100),
            'product_data' => ['name' => 'Huubie · Plan ' . $sub['plan']],
        ];

        if ($sub['modules'])  $price['product_data']['description'] = 'Módulos: ' . $sub['modules'];
        if ($interval)        $price['recurring'] = ['interval' => $interval];

        $line = ['quantity' => 1, 'price_data' => $price];

        list($tax, $error) = $this->taxRate();
        if ($error) return [null, $error];
        $line['tax_rates'] = [$tax];

        $meta = ['subscription_id' => $sub['id'], 'company_id' => $sub['company_id']];

        $params = [
            'mode'                => $interval ? 'subscription' : 'payment',
            'success_url'         => $success,
            'cancel_url'          => $cancel,
            'client_reference_id' => $sub['id'],
            'locale'              => 'es-419',
            'line_items'          => [$line],
            'metadata'            => $meta,
        ];

        // La metadata va tambien en lo que nace del pago: las renovaciones
        // llegan por la suscripcion, sin pasar por esta sesion.
        if ($interval) $params['subscription_data'] = ['metadata' => $meta];
        else           $params['payment_intent_data'] = ['metadata' => $meta];

        if ($sub['stripe_customer_id'])  $params['customer'] = $sub['stripe_customer_id'];
        elseif ($sub['owner_email'])     $params['customer_email'] = $sub['owner_email'];

        list($session, $error) = Stripe::request('POST', 'checkout/sessions', $params);

        return $error ? [null, $error] : [$session['url'], null];
    }

    /*  Cambia lo que cobra una suscripcion de Stripe a partir de su SIGUIENTE
        factura (cambio de plan desde Configuración). Sin prorrateo: lo que
        queda del periodo ya pagado no se cobra ni se devuelve. Devuelve el
        error, o null si quedo.

        El precio va en linea, como en checkout(); aqui Stripe pide el producto
        ya creado, asi que se crea uno con el nombre del plan. */
    function changePrice($stripeSubscriptionId, $name, $amount, $currency, $cycle, $modules = '') {
        $interval = self::INTERVALS[$cycle] ?? null;

        if (!$interval)   return 'Ese plan no se cobra de forma recurrente. Contáctanos para cambiarlo.';
        if ($amount <= 0) return 'Ese plan no tiene un precio para cobrar en línea. Contáctanos.';

        list($stripeSub, $error) = Stripe::request('GET', 'subscriptions/' . rawurlencode($stripeSubscriptionId));
        if ($error) return $error;

        $item = $stripeSub['items']['data'][0]['id'] ?? null;
        if (!$item) return 'No encontramos el cobro de tu suscripción en Stripe.';

        $product = ['name' => $name];
        if ($modules !== '') $product['description'] = 'Módulos: ' . $modules;

        list($product, $error) = Stripe::request('POST', 'products', $product);
        if ($error) return $error;

        list($tax, $error) = $this->taxRate();
        if ($error) return $error;

        list(, $error) = Stripe::request('POST', 'subscriptions/' . rawurlencode($stripeSubscriptionId), [
            'proration_behavior' => 'none',
            'items' => [[
                'id'         => $item,
                'tax_rates'  => [$tax],
                'price_data' => [
                    'currency'    => strtolower($currency ?: 'MXN'),
                    'product'     => $product['id'],
                    'unit_amount' => (int) round($amount * 100),
                    'recurring'   => ['interval' => $interval],
                ],
            ]],
        ]);

        return $error;
    }

    // El IVA como impuesto de Stripe: se busca el que ya exista y, la primera
    // vez, se crea. Asi no hay un id que copiar de pruebas a produccion.
    private function taxRate() {
        list($list, $error) = Stripe::request('GET', 'tax_rates', ['active' => 'true', 'limit' => 100]);
        if ($error) return [null, $error];

        foreach ($list['data'] as $rate) {
            if ((float) $rate['percentage'] === (float) self::IVA && !$rate['inclusive'] && $rate['display_name'] === 'IVA') {
                return [$rate['id'], null];
            }
        }

        list($rate, $error) = Stripe::request('POST', 'tax_rates', [
            'display_name' => 'IVA',
            'percentage'   => self::IVA,
            'inclusive'    => 'false',
            'country'      => 'MX',
        ]);

        return $error ? [null, $error] : [$rate['id'], null];
    }

    /*  ¿Se pago esta sesion? Devuelve la suscripcion nuestra ya activada, o
        null si no esta pagada o no es nuestra. */
    function reconcile($sessionId) {
        if (!preg_match('/^cs_[A-Za-z0-9_]+$/', (string) $sessionId)) return null;

        list($session, $error) = Stripe::request('GET', 'checkout/sessions/' . $sessionId, ['expand' => ['subscription', 'invoice']]);

        if ($error || ($session['payment_status'] ?? '') !== 'paid') return null;

        $subscriptionId = (int) ($session['metadata']['subscription_id'] ?? 0);
        if ($subscriptionId <= 0) return null;

        $stripeSub = is_array($session['subscription'] ?? null) ? $session['subscription'] : null;
        $invoice   = is_array($session['invoice'] ?? null) ? $session['invoice'] : null;

        $this->activate($subscriptionId, [
            'customer'     => is_array($session['customer'] ?? null) ? $session['customer']['id'] : ($session['customer'] ?? null),
            'subscription' => $stripeSub ? $stripeSub['id'] : null,
            'period_end'   => $stripeSub ? $this->periodEnd($stripeSub) : null,
            'amount'       => ((int) ($session['amount_total'] ?? 0)) / 100,
            'currency'     => strtoupper((string) ($session['currency'] ?? 'MXN')),
            // La factura cuando la hay: es la misma llave con la que llega invoice.paid.
            'payment_id'   => $invoice ? $invoice['id'] : $session['id'],
            'invoice_url'  => $invoice ? ($invoice['hosted_invoice_url'] ?? null) : null,
        ]);

        return $this->subscription($subscriptionId);
    }

    // Segun la version de la API de la cuenta, el fin del periodo viene en la
    // suscripcion o en su primer renglon.
    private function periodEnd($stripeSub) {
        $end = $stripeSub['current_period_end'] ?? ($stripeSub['items']['data'][0]['current_period_end'] ?? null);
        return $end ? (int) $end : null;
    }

    /*  Deja la suscripcion al corriente. Se puede repetir sin daño.

        Pagar activa a la empresa este como este: pendiente (recien dada de
        alta), suspendida o cancelada. Quien paga, vuelve a operar. */
    function activate($subscriptionId, $pay) {
        $sub = $this->subscription($subscriptionId);
        if (!$sub) return;

        $this->_CUD("
            UPDATE subscriptions
               SET status = 'active',
                   starts_at = IF(stripe_subscription_id IS NULL OR starts_at IS NULL, NOW(), starts_at),
                   ends_at = NULL,
                   next_billing_date = IF(? IS NULL, next_billing_date, FROM_UNIXTIME(?)),
                   stripe_subscription_id = COALESCE(?, stripe_subscription_id),
                   updated_at = NOW()
             WHERE id = ?
        ", [$pay['period_end'], $pay['period_end'], $pay['subscription'], $sub['id']]);

        $this->_CUD("
            UPDATE companies
               SET status = 'active',
                   stripe_customer_id = COALESCE(?, stripe_customer_id)
             WHERE id = ?
        ", [$pay['customer'], $sub['company_id']]);

        if (!empty($pay['payment_id'])) {
            $this->_CUD("
                INSERT IGNORE INTO payment_history
                    (amount, currency, status, gateway, stripe_id, paid_at, invoice_url, created_at, subscription_id, company_id)
                VALUES (?, ?, 'paid', 'stripe', ?, NOW(), ?, NOW(), ?, ?)
            ", [$pay['amount'], $pay['currency'], $pay['payment_id'], $pay['invoice_url'], $sub['id'], $sub['company_id']]);
        }

        if ($this->claim('welcome:' . $sub['id'], 'welcome')) $this->welcome($sub);
    }

    /*  EL WEBHOOK. Devuelve true si el evento quedo atendido (o no nos toca):
        con false, Stripe lo reintenta mas tarde. */
    function handle($event) {
        // Stripe reintenta y a veces repite: cada evento se atiende una vez.
        if (!$this->claim($event['id'], $event['type'])) return true;

        try {
            $this->dispatch($event['type'], $event['data']['object'] ?? []);
        } catch (\Throwable $e) {
            // No quedo atendido: se suelta para que el reintento de Stripe si entre.
            $this->_CUD("DELETE FROM stripe_events WHERE id = ?", [$event['id']]);
            return false;
        }

        return true;
    }

    private function dispatch($type, $object) {
        switch ($type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
                $this->reconcile($object['id'] ?? '');
                break;

            // Cada cobro de la suscripcion: el primero y las renovaciones.
            case 'invoice.paid':
                $sub = $this->byInvoice($object);
                if (!$sub) break;

                $this->activate($sub, [
                    'customer'     => $object['customer'] ?? null,
                    'subscription' => $this->invoiceSubscription($object),
                    'period_end'   => $object['lines']['data'][0]['period']['end'] ?? null,
                    'amount'       => ((int) ($object['amount_paid'] ?? 0)) / 100,
                    'currency'     => strtoupper((string) ($object['currency'] ?? 'MXN')),
                    'payment_id'   => $object['id'],
                    'invoice_url'  => $object['hosted_invoice_url'] ?? null,
                ]);
                break;

            // No se pudo cobrar la renovacion: la empresa queda en "solo inicio".
            case 'invoice.payment_failed':
                $sub = $this->byInvoice($object);
                if ($sub) $this->_CUD("UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE id = ? AND status = 'active'", [$sub]);
                break;

            case 'customer.subscription.deleted':
                $this->_CUD("UPDATE subscriptions SET status = 'cancelled', ends_at = NOW(), updated_at = NOW() WHERE stripe_subscription_id = ?", [$object['id'] ?? '']);
                break;
        }
    }

    // -- Internos --

    private function invoiceSubscription($invoice) {
        return $invoice['subscription'] ?? ($invoice['parent']['subscription_details']['subscription'] ?? null);
    }

    /*  A cual suscripcion nuestra pertenece una factura de Stripe. Por el id
        de su suscripcion; y si es la primera factura y aun no lo guardamos
        (llego antes que el regreso del pago), por la metadata que le pusimos. */
    private function byInvoice($invoice) {
        $stripeSub = $this->invoiceSubscription($invoice);

        if ($stripeSub) {
            $sql = $this->_Read("SELECT id FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1", [$stripeSub]);
            if (!empty($sql)) return (int) $sql[0]['id'];
        }

        $meta = $invoice['subscription_details']['metadata'] ?? ($invoice['parent']['subscription_details']['metadata'] ?? []);

        return (int) ($meta['subscription_id'] ?? 0) ?: null;
    }

    /*  "Esto me toca a mi": true solo para el primero que lo pide. INSERT
        IGNORE sobre la llave primaria, y se pregunta cuantas filas entraron;
        _CUD no lo dice, por eso va directo sobre la conexion. */
    private function claim($id, $type) {
        try {
            $this->connect();
            if (!$this->connected) return false;

            $stm = $this->mysql->prepare("INSERT IGNORE INTO stripe_events (id, type) VALUES (?, ?)");
            $stm->execute([$id, $type]);
            $first = $stm->rowCount() === 1;

            $this->disconnect();
            return $first;
        } catch (PDOException $e) {
            $this->writeToLog("[ STRIPE ] :: no se pudo registrar {$id}: " . $e->getMessage());
            return false;
        }
    }

    /*  El correo de quien acaba de pagar: el enlace del sistema y su usuario.
        La contraseña no va: la eligio el y un correo no es lugar para ella. */
    private function welcome($sub) {
        if (empty($sub['owner_email'])) return;

        $url    = $this->url;
        $nombre = trim((string) $sub['owner_name']);

        $texto  = ($nombre === '' ? 'Hola.' : "Hola, {$nombre}.") . "\n\n";
        $texto .= "Recibimos tu pago: {$sub['company']} ya está activa en Huubie con el plan {$sub['plan']}.\n\n";
        $texto .= "Entra aquí:\n{$url}\n\n";
        $texto .= "Tu usuario: {$sub['owner_email']}\n";
        $texto .= "Tu contraseña: la que elegiste al registrarte. Si no la recuerdas, usa \"¿La olvidaste?\" en esa misma página.\n\n";
        $texto .= "La primera vez que entres te pediremos completar los datos de tu empresa. Toma un minuto.\n\n";
        $texto .= "¿Dudas? Escríbenos a coffeesoftdev@gmail.com o llama al 962 149 3749.";

        (new Message)->correo($sub['owner_email'], 'Tu cuenta de Huubie está lista', $texto);
    }
}
