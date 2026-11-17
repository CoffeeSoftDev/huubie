<?php
/*  Lealtad por WhatsApp: la tarjeta digital y el aviso de «premio listo».

    Salen como plantillas de Meta por el numero de la empresa (wa_agent), igual
    que los recordatorios de saldo: quedan en la conversacion del cliente en
    Ventas › WhatsApp y no le llegan a quien escribio BAJA. Sin wa_agent no sale
    nada; sin WHATSAPP_META_TOKEN el envio es simulado (no sale a la red).
      'tarjeta'  1 nombre · 2 tipo de tarjeta · 3 negocio · 4 enlace de la tarjeta
      'premio'   1 nombre · 2 sellos de la meta · 3 negocio · 4 premio · 5 enlace
    El texto aprobado vive en waTemplateText (mdl-whatsapp-recordatorios.php).

    Dos formas de usarlo:
      - trait LoyaltyWhatsApp: lo usa lealtad/ctrl/ctrl-tarjetas.php, que ya
        carga WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders y LoyaltyCards.
      - clase LoyaltyNotifier: la usa order/ctrl/ctrl-ventas.php para avisar el
        premio SIN cargar el WhatsApp en la clase de Vender. Solo se declara si
        los archivos de WhatsApp estan en el servidor (en prod pueden subir
        despues que Lealtad): sin ellos, Vender cobra igual y no avisa.

    Todo es protected o private: Permission::dispatch despacha cualquier metodo
    publico del ctrl, tambien los de un trait. */
trait LoyaltyWhatsApp {

    // -- Estado --

    // Para la pantalla: si la empresa tiene numero de WhatsApp (wa_agent) y si el envio es simulado.
    protected function loyaltyWaState() {
        try {
            $agent = $this->qWaReminderAgent((int) $this->companyId());
        } catch (Throwable $e) {
            $agent = null;
        }

        return ['ready' => (bool) $agent, 'simulated' => (new WhatsAppMeta())->status()['simulated']];
    }

    // -- Mensajes --

    // La tarjeta digital: nombre, tipo, negocio y enlace.
    protected function loyaltySendCard($card, $phone) {
        return $this->loyaltySend($card, $phone, 'tarjeta', function ($first, $business, $link) use ($card) {
            return [$first, (string) $card['type'], $business, $link];
        });
    }

    // Premio listo: nombre, sellos de la meta, negocio, premio y enlace de la tarjeta.
    protected function loyaltySendReward($card, $phone) {
        return $this->loyaltySend($card, $phone, 'premio', function ($first, $business, $link) use ($card) {
            return [$first, (string) (int) $card['stamp_goal'], $business, (string) $card['reward_name'], $link];
        });
    }

    /*  Aparta el mensaje en el chat (se crea si falta) y lo manda. Quien escribio
        BAJA no lo recibe. Devuelve ['status' => sent|simulated|failed|skip, 'detail']. */
    private function loyaltySend($card, $phone, $key, callable $values) {
        $companyId = (int) $this->companyId();
        $agent     = $this->qWaReminderAgent($companyId);

        if (!$agent) return ['status' => 'skip', 'detail' => 'La empresa no tiene número de WhatsApp: se da de alta en Ventas › WhatsApp.'];

        $company  = $this->qCompany($companyId);
        $business = trim((string) ($company['name'] ?? ''));
        $name     = $card['owner_id'] !== null && trim((string) $card['customer']) !== '' ? trim((string) $card['customer']) : trim((string) $card['holder']);
        $params   = $values(
            $this->loyaltyFirst($name),
            $business !== '' ? $business : (string) $this->scope()['branch'],
            $this->loyaltyPublicLink($this->loyaltyCardToken((int) $card['id']))
        );

        $text     = $this->waTemplateFill($key, $params);
        $stamp    = date('Y-m-d H:i:s', $this->inboxNow());
        $waId     = ($this->inboxMeta()->status()['simulated'] ? 'SIM-52' : '52') . $phone;
        $branchId = (int) $this->branchId();
        $userId   = $this->userId();
        $chatName = mb_substr($name, 0, 120, 'UTF-8');

        $claim = $this->transaction(function () use ($companyId, $phone, $waId, $chatName, $text, $stamp, $branchId, $userId) {
            $chat = $this->qWaReminderChat($companyId, $phone, $waId, $chatName, $stamp);

            if (!$chat) throw new RuntimeException('lealtad por WhatsApp: no se pudo abrir el chat');

            if ((int) $chat['opt_out'] === 1) return ['skip' => 'El cliente escribió BAJA: ya no le llegan mensajes de la tienda.'];

            $this->qWaChooseBranch((int) $chat['id'], $branchId, $stamp);

            return ['chat' => $chat, 'message_id' => $this->waTemplateClaim($chat, $text, $userId, $stamp)];
        });

        if (isset($claim['skip'])) return ['status' => 'skip', 'detail' => $claim['skip']];

        $sent = $this->waTemplateDeliver($agent, $claim['chat'], $key, $params, $claim['message_id']);

        return ['status' => $sent['status'], 'detail' => (string) $sent['detail']];
    }

    // -- Enlace de la tarjeta --

    // El token del enlace; la primera vez lo crea (si dos lo piden a la vez, gana el primero).
    protected function loyaltyCardToken($cardId) {
        $token = $this->qCardLinkToken($cardId);

        if ($token !== '') return $token;

        $this->must($this->qSetCardToken($cardId, $this->loyaltyFreshToken(), true), 'loyaltyCardToken');

        $token = $this->qCardLinkToken($cardId);

        if ($token === '') throw new RuntimeException('loyaltyCardToken: sin token');

        return $token;
    }

    // 32 caracteres hex que no use otra tarjeta.
    protected function loyaltyFreshToken() {
        for ($i = 0; $i < 5; $i++) {
            $token = bin2hex(random_bytes(16));

            if (!$this->qCardTokenTaken($token)) return $token;
        }

        throw new RuntimeException('loyaltyFreshToken: sin token libre');
    }

    /*  .../app/lealtad/tarjeta.php?t=... con el host por el que se entro. El ctrl
        vive en app/<modulo>/ctrl/: tres carpetas arriba esta app/. */
    protected function loyaltyHostLink($token) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host  = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $app   = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/'), 3)), '/');

        return ($https ? 'https' : 'http') . '://' . $host . $app . '/lealtad/tarjeta.php?t=' . rawurlencode($token);
    }

    /*  El enlace que va en un mensaje. Con WHATSAPP_PUBLIC_URL (la de pedir.php y
        portal.php: .../app/order) se cambia a .../app/lealtad, para que abra
        afuera aunque aqui se haya entrado por localhost o una IP. Sin ella, el
        host por el que se entro. */
    protected function loyaltyPublicLink($token) {
        $env = dirname(__DIR__, 3) . '/core/config/.env';
        $ini = is_readable($env) ? @parse_ini_file($env, false, INI_SCANNER_RAW) : false;
        $url = is_array($ini) ? rtrim(trim((string) ($ini['WHATSAPP_PUBLIC_URL'] ?? '')), '/') : '';

        if (preg_match('~^https?://~i', $url) && preg_match('~/order$~', $url)) {
            return preg_replace('~/order$~', '/lealtad', $url) . '/tarjeta.php?t=' . rawurlencode($token);
        }

        return $this->loyaltyHostLink($token);
    }

    // -- Formato --

    // 10 digitos de Mexico (con o sin el 52 delante). '' = no sirve.
    protected function loyaltyPhone($raw) {
        $digits = (string) preg_replace('/\D/', '', (string) $raw);

        if (strlen($digits) === 12 && strpos($digits, '52') === 0) $digits = substr($digits, 2);

        return strlen($digits) === 10 ? $digits : '';
    }

    // El primer nombre con mayuscula inicial; sin nombre, «cliente» (lo mismo que los recordatorios).
    protected function loyaltyFirst($name) {
        $first = (string) (preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY)[0] ?? '');

        return $first === '' ? 'cliente' : mb_convert_case(mb_strtolower($first, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
    }
}

// -- Para Vender --

$loyaltyWaFiles = [
    __DIR__ . '/mdl-whatsapp-agente.php',
    __DIR__ . '/mdl-whatsapp-recordatorios.php',
    __DIR__ . '/mdl-lealtad.php',
    dirname(__DIR__, 3) . '/core/helpers/_WhatsAppMeta.php'
];

if (class_exists('core') && !class_exists('LoyaltyNotifier') && !array_filter($loyaltyWaFiles, fn ($file) => !is_file($file))) {
    foreach ($loyaltyWaFiles as $file) require_once $file;

    /*  El aviso de premio listo desde Vender, en su propia clase: ctrl-ventas no
        carga los traits de WhatsApp. Usa la misma sesion (empresa, sucursal y
        usuario) y su propia conexion: la venta ya se confirmo. */
    class LoyaltyNotifier extends core {

        use LoyaltyCards, WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders, LoyaltyWhatsApp;

        public function rewardReady($card, $phone) {
            return $this->loyaltySendReward($card, $phone);
        }
    }
}
