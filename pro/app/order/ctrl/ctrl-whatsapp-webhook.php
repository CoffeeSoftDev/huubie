<?php
/*  F1 · Agente de WhatsApp: la direccion a la que Meta (Cloud API) avisa cada
    mensaje que le escriben al numero de una empresa.

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
      - En F1 no se le contesta nada al cliente. Los "statuses" (entregado, leido)
        llegan en F2, con el envio. */

require_once __DIR__ . '/../mdl/mdl-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';

class WhatsAppWebhook extends mdl {

    use WhatsAppInbox;

    private $meta;

    public function __construct(?WhatsAppMeta $meta = null) {
        parent::__construct();
        $this->meta = $meta ?: new WhatsAppMeta();
    }

    // [codigo HTTP, texto de la respuesta, conteo del POST (new, repeated, ignored)]
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
        $count     = ['new' => 0, 'repeated' => 0, 'ignored' => 0];
        $companies = [];   // phone_number_id => company_id (0 = sin alta)

        foreach (WhatsAppMeta::incoming($payload) as $msg) {
            if ($msg['skip'] !== '') {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: mensaje ignorado ({$msg['skip']})");
                continue;
            }

            $number = $msg['phone_number_id'];

            if (!array_key_exists($number, $companies)) {
                $agent = $this->qWaAgentByNumber($number);
                if ($agent === null) throw new RuntimeException('wa_agent: sin respuesta de la base');

                $companies[$number] = (int) $agent['n'] > 0 ? (int) $agent['company_id'] : 0;
            }

            if ($companies[$number] === 0) {
                $count['ignored']++;
                $this->log("[ WEBHOOK ] :: el numero {$number} no esta en wa_agent; mensaje {$msg['wamid']} ignorado");
                continue;
            }

            $companyId = $companies[$number];

            $saved = $this->transaction(function () use ($companyId, $msg) {
                return $this->saveIncoming($companyId, $msg);
            });

            $count[$saved ? 'new' : 'repeated']++;
        }

        return $count;
    }

    // Un mensaje, dentro de transaction(). false = ya estaba (Meta lo repitio).
    private function saveIncoming($companyId, array $msg) {
        $now    = date('Y-m-d H:i:s');
        $sentAt = date('Y-m-d H:i:s', $msg['sent_at']);

        $chatId = $this->qWaLockChat($companyId, $msg['phone'], $msg['wa_id'], $msg['name'], $now);
        if ($chatId <= 0) throw new RuntimeException('wa_chat: no se pudo abrir el chat');

        if ($this->qWaMessageExists($msg['wamid'])) return false;

        $this->must($this->qCreateWaMessage([
            'values' => ['chat_id', 'direction', 'provider_id', 'type', 'body', 'media_id', 'media_type', 'status', 'sent_at', 'raw', 'created_at'],
            'data'   => [$chatId, 'in', $msg['wamid'], $msg['type'], $msg['body'], $msg['media_id'], $msg['media_type'], 'received', $sentAt, $msg['raw'], $now],
        ]), 'wa_message');

        $this->qWaTouchChat($chatId, $sentAt, $now);

        return true;
    }

    // -- Ayudantes --

    private function must($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
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
