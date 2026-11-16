<?php
/*  Agente de WhatsApp (F1 y F2): la direccion a la que Meta (Cloud API) avisa
    cada mensaje que le escriben al numero de una empresa y cada cambio de
    estado (enviado, entregado, leido, fallido) de lo que se le contesto.

    En el panel de Meta (WhatsApp > Configuracion > Webhook):
      URL de devolucion de llamada  la de este archivo, con https
                                    (.../pro/app/order/ctrl/ctrl-whatsapp-webhook.php)
      Token de verificacion          el WHATSAPP_META_VERIFY_TOKEN del .env
      Campo suscrito                 messages

    SIN sesion: no pasa por _Session.php ni por Permission::dispatch. Solo
    entra lo que Meta firma con el secreto de la app (WHATSAPP_META_APP_SECRET).

      GET   la verificacion: contesta hub.challenge si el token coincide; si no, 403.
      POST  el aviso: sin firma valida, 401. Guarda y contesta 200 al instante.

    Reglas que no se ven en el codigo de un vistazo:
      - La empresa sale del phone_number_id que manda Meta, buscado en wa_agent.
        Un numero sin fila se ignora con 200 (para que Meta no reintente) y queda
        apuntado en core/helpers/whatsapp.log.
      - El wamid es unico en wa_message: un aviso que Meta repite se guarda una
        sola vez. Cada mensaje va en su propia transaccion, con su chat bloqueado
        (FOR UPDATE) mientras se revisa y se guarda.
      - Si la base falla se contesta 500 y Meta reintenta el aviso completo (hasta
        7 dias); lo que ya se habia guardado cuenta como repetido.
      - El telefono se guarda en 10 digitos si es de Mexico (Meta manda 521 + 10).
      - Un status cambia wa_message.status buscando por provider_id (el wamid que
        dio Meta al enviar), solo en mensajes que salieron de esa empresa, y solo
        hacia adelante: un "entregado" que llega despues del "leido" no lo regresa.
      - Despues de guardar corre lo automatico del agente (WhatsAppAgentFlow): la
        sucursal que eligio el cliente y el menu de sucursales. Fuera de horario
        no sale nada. Si eso falla se apunta en el log y Meta recibe 200 igual:
        el mensaje ya quedo guardado. */

require_once __DIR__ . '/../mdl/mdl-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';

class WhatsAppWebhook extends mdl {

    use WhatsAppInbox, WhatsAppAgentFlow;

    // De donde a donde puede avanzar un status de Meta ('sent' ya es el de salida).
    const STATUS_FROM = [
        'delivered' => ['sent'],
        'read'      => ['sent', 'delivered'],
        'failed'    => ['sent', 'delivered'],
    ];

    private $meta;
    private $companies = [];   // phone_number_id => company_id (0 = sin alta), por aviso

    public function __construct(?WhatsAppMeta $meta = null) {
        parent::__construct();
        $this->meta = $meta ?: new WhatsAppMeta();
    }

    // El agente envia con el mismo WhatsAppMeta (el arnes le pone uno de prueba).
    protected function inboxMeta() {
        return $this->meta;
    }

    protected function inboxLog($message) {
        $this->log($message);
    }

    // [codigo HTTP, texto de la respuesta, conteo del POST (new, repeated, ignored, statuses)]
    public function handle($method, array $query, $raw, $signature) {
        if ($method === 'GET') {
            $challenge = $this->meta->challenge($query);

            return $challenge === null ? [403, 'forbidden', null] : [200, $challenge, null];
        }

        if ($method !== 'POST') return [405, 'method not allowed', null];

        $raw       = (string) $raw;
        $signature = (string) $signature;

        if (strlen($raw) > WhatsAppMeta::MAX_BODY) return [413, 'too large', null];

        if (!$this->meta->signed($raw, $signature)) {
            // Sin encabezado es alguien que no es Meta: no se apunta.
            if ($signature !== '') {
                $this->log('[ WEBHOOK ] :: firma rechazada' . ($this->meta->hasSecret() ? '' : ' (falta WHATSAPP_META_APP_SECRET en el .env)'));
            }

            return [401, 'bad signature', null];
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            $this->log('[ WEBHOOK ] :: aviso firmado que no es JSON');

            return [400, 'bad json', null];
        }

        try {
            return [200, 'ok', $this->receive($payload)];
        } catch (Throwable $e) {
            $this->log('[ WEBHOOK ] :: ' . $e->getMessage());

            return [500, 'error', null];
        }
    }

    // -- Guardar --

    protected function receive(array $payload) {
        $count   = ['new' => 0, 'repeated' => 0, 'ignored' => 0, 'statuses' => 0];
        $replies = [];   // company_id => [chat_id => el texto mas nuevo del cliente]

        $this->companies = [];

        foreach (WhatsAppMeta::incoming($payload) as $msg) {
            if ($msg['skip'] !== '') {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: mensaje ignorado ({$msg['skip']})");
                continue;
            }

            $companyId = $this->companyOf($msg['phone_number_id']);

            if ($companyId === 0) {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: el numero {$msg['phone_number_id']} no esta en wa_agent; mensaje {$msg['wamid']} ignorado");
                continue;
            }

            $chatId = $this->transaction(function () use ($companyId, $msg) {
                return $this->inboxSave($companyId, $msg);
            });

            if ($chatId > 0) {
                $count['new']++;
                $replies[$companyId][$chatId] = $msg['body'];
            } else {
                $count['repeated']++;
            }
        }

        foreach (WhatsAppMeta::statuses($payload) as $st) {
            if ($st['skip'] !== '') {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: status ignorado ({$st['skip']})");
                continue;
            }

            $companyId = $this->companyOf($st['phone_number_id']);
            $applied   = $companyId > 0 ? $this->applyStatus($companyId, $st) : null;

            if ($applied === null) {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: status {$st['status']} de {$st['wamid']} sin mensaje que le corresponda");
            } else if ($applied) {
                $count['statuses']++;
            }
        }

        foreach ($replies as $companyId => $chats) {
            try {
                $this->inboxAfter($companyId, $chats);
            } catch (Throwable $e) {
                $this->log('[ AGENTE ] :: empresa ' . $companyId . ' :: ' . $e->getMessage());
            }
        }

        return $count;
    }

    // true = cambio; false = ya estaba igual o mas adelante; null = no hay mensaje de esa empresa con ese wamid.
    private function applyStatus($companyId, array $st) {
        $row = $this->qWaOutByProvider($companyId, $st['wamid']);
        if ($row === null) return null;

        $from = self::STATUS_FROM[$st['status']] ?? [];
        if (!in_array($row['status'], $from, true)) return false;

        $this->qWaSetStatus((int) $row['id'], $st['status'], $st['error'], $from);

        return true;
    }

    // -- Ayudantes --

    private function companyOf($number) {
        if (!array_key_exists($number, $this->companies)) {
            $agent = $this->qWaAgentByNumber($number);
            if ($agent === null) throw new RuntimeException('wa_agent: sin respuesta de la base');

            $this->companies[$number] = (int) $agent['n'] > 0 ? (int) $agent['company_id'] : 0;
        }

        return $this->companies[$number];
    }

    protected function log($message) {
        WhatsAppMeta::log($message);
    }
}

// Desde la consola solo se carga la clase (asi la usa el arnes de pruebas).
if (PHP_SAPI === 'cli') return;

header('Content-Type: text/plain; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$raw    = '';

if ($method === 'POST') {
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > WhatsAppMeta::MAX_BODY) {
        http_response_code(413);
        exit('too large');
    }

    $raw = (string) file_get_contents('php://input', false, null, 0, WhatsAppMeta::MAX_BODY + 1);
}

list($code, $text) = (new WhatsAppWebhook())->handle($method, $_GET, $raw, $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');

http_response_code($code);
echo $text;
