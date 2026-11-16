<?php
/*  WHATSAPP DE META (Cloud API) para el agente: lo que llega al webhook.

    Solo entiende a Meta: no toca la base ni manda nada. Lo usa
    app/order/ctrl/ctrl-whatsapp-webhook.php. El envio por Meta llega en F2.

        WHATSAPP_META_APP_SECRET    el secreto de la app de Meta (Configuracion de
                                    la app > Basica). Con el, Meta firma cada aviso.
        WHATSAPP_META_VERIFY_TOKEN  la palabra que se escribe igual en el panel de
                                    Meta al registrar el webhook.

    Los dos viven en pro/core/config/.env y nunca salen en el log ni en una
    respuesta. Sin secreto, signed() rechaza todo; sin token, challenge() tambien.

    Los avisos al duenio (Green API / UltraMsg) siguen en _WhatsApp.php, sin
    cambios: este archivo es solo del agente. */
class WhatsAppMeta {
    const MAX_BODY = 1048576;   // bytes del aviso de Meta; mas grande = 413
    const MAX_TEXT = 4096;      // caracteres de body (lo mas largo que Meta deja escribir)
    const MAX_NAME = 120;       // caracteres del nombre del perfil (wa_chat.name)
    const MAX_RAW  = 65000;     // bytes de raw (columna TEXT); mas grande = no se guarda
    const MEDIA    = ['image', 'audio', 'video', 'document', 'sticker'];

    private $secret;
    private $verifyToken;

    // Sin argumentos lee el .env. Con argumentos (el arnes de pruebas) no lo toca.
    function __construct($secret = null, $verifyToken = null) {
        if ($secret === null || $verifyToken === null) {
            $env = $this->env();
            if ($secret === null)      $secret      = $env['WHATSAPP_META_APP_SECRET'] ?? '';
            if ($verifyToken === null) $verifyToken = $env['WHATSAPP_META_VERIFY_TOKEN'] ?? '';
        }

        $this->secret      = (string) $secret;
        $this->verifyToken = (string) $verifyToken;
    }

    // -- .env --

    // Solo las llaves WHATSAPP_META_*; las de la base y las demas no se guardan aqui.
    private function env() {
        $ruta = __DIR__ . '/../config/.env';
        $env  = is_file($ruta) ? @parse_ini_file($ruta) : false;

        $out = [];
        if (!is_array($env)) return $out;

        foreach ($env as $key => $value) {
            if (strpos($key, 'WHATSAPP_META_') === 0) $out[$key] = trim((string) $value);
        }

        return $out;
    }

    function hasSecret() {
        return $this->secret !== '';
    }

    // -- Verificacion del webhook (GET) --

    /*  Meta manda hub.mode, hub.verify_token y hub.challenge; PHP cambia el punto
        por guion bajo. Devuelve el challenge que hay que contestar tal cual, o
        null si el token no coincide. */
    function challenge(array $query) {
        $mode      = $this->str($query, 'hub_mode');
        $token     = $this->str($query, 'hub_verify_token');
        $challenge = $this->str($query, 'hub_challenge');

        if ($mode !== 'subscribe' || $this->verifyToken === '') return null;
        if (!hash_equals($this->verifyToken, $token)) return null;
        if (!preg_match('/^[A-Za-z0-9_.-]{1,128}$/', $challenge)) return null;

        return $challenge;
    }

    private function str(array $query, $key) {
        return isset($query[$key]) && is_string($query[$key]) ? $query[$key] : '';
    }

    // -- Firma (POST) --

    // X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo crudo con el secreto de la app>.
    function signed($raw, $header) {
        if ($this->secret === '' || !is_string($raw) || !is_string($header)) return false;
        if (!preg_match('/^sha256=([a-f0-9]{64})$/i', trim($header), $m)) return false;

        return hash_equals(hash_hmac('sha256', $raw, $this->secret), strtolower($m[1]));
    }

    // -- Mensajes que llegaron --

    /*  Cada mensaje del cliente que trae el aviso, ya plano:
          phone_number_id  el numero de la empresa que lo recibio
          wa_id, phone     el remitente como lo manda Meta y en 10 digitos (localPhone)
          name             el nombre de su perfil ('' si no vino)
          wamid, type, body, media_id, media_type
          sent_at          unix; la hora de Meta, o la de ahora si no vino
          raw              el mensaje en JSON (null si no cabe)
          skip             '' = se guarda; si no, por que se ignora
        Los "statuses" (entregado, leido) y los demas campos no son mensajes del
        cliente: no salen aqui. */
    static function incoming(array $payload) {
        $out = [];
        if (self::pick($payload, ['object']) !== 'whatsapp_business_account') return $out;

        foreach (self::items($payload, 'entry') as $entry) {
            foreach (self::items($entry, 'changes') as $change) {
                if (self::pick($change, ['field']) !== 'messages') continue;

                $value  = (is_array($change) && isset($change['value']) && is_array($change['value'])) ? $change['value'] : [];
                $number = self::pick($value, ['metadata', 'phone_number_id']);

                $names = [];
                foreach (self::items($value, 'contacts') as $contact) {
                    $waId = self::pick($contact, ['wa_id']);
                    if ($waId !== '') $names[$waId] = self::pick($contact, ['profile', 'name']);
                }

                foreach (self::items($value, 'messages') as $message) {
                    $out[] = self::flat($number, $names, $message);
                }
            }
        }

        return $out;
    }

    private static function flat($number, array $names, $message) {
        $wamid = self::pick($message, ['id']);
        $from  = self::pick($message, ['from']);
        $type  = strtolower(self::pick($message, ['type']));
        $ts    = self::pick($message, ['timestamp']);

        $skip = '';
        if (!preg_match('/^\d{1,32}$/', $number))  $skip = 'sin phone_number_id';
        else if ($wamid === '' || strlen($wamid) > 128) $skip = 'sin wamid';
        else if (!preg_match('/^\d{6,20}$/', $from))    $skip = 'sin remitente';

        if (!preg_match('/^[a-z_]{1,20}$/', $type)) $type = 'unknown';

        list($body, $mediaId, $mediaType) = self::content($type, is_array($message) ? $message : []);

        $raw = json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return [
            'phone_number_id' => $number,
            'wa_id'           => $from,
            'phone'           => self::localPhone($from),
            'name'            => self::cut($names[$from] ?? '', self::MAX_NAME),
            'wamid'           => $wamid,
            'type'            => $type,
            'body'            => self::cut($body, self::MAX_TEXT),
            'media_id'        => ($mediaId !== '' && strlen($mediaId) <= 64) ? $mediaId : null,
            'media_type'      => $mediaType !== '' ? self::cut($mediaType, 80) : null,
            'sent_at'         => preg_match('/^\d{1,12}$/', $ts) ? (int) $ts : time(),
            'raw'             => ($raw !== false && strlen($raw) <= self::MAX_RAW) ? $raw : null,
            'skip'            => $skip,
        ];
    }

    // [body, media_id, media_type] segun el tipo. Lo que no se entiende queda con body ''.
    private static function content($type, array $message) {
        if ($type === 'text') return [self::pick($message, ['text', 'body']), '', ''];

        if (in_array($type, self::MEDIA, true)) {
            $body = self::pick($message, [$type, 'caption']);
            if ($body === '' && $type === 'document') $body = self::pick($message, ['document', 'filename']);

            return [$body, self::pick($message, [$type, 'id']), self::pick($message, [$type, 'mime_type'])];
        }

        if ($type === 'button') return [self::pick($message, ['button', 'text']), '', ''];

        if ($type === 'interactive') {
            $kind = self::pick($message, ['interactive', 'type']);
            $body = ($kind === 'button_reply' || $kind === 'list_reply') ? self::pick($message, ['interactive', $kind, 'title']) : '';

            return [$body, '', ''];
        }

        if ($type === 'location') {
            $parts = array_filter([self::pick($message, ['location', 'name']), self::pick($message, ['location', 'address'])], 'strlen');
            if ($parts) return [implode(', ', $parts), '', ''];

            $lat = self::pick($message, ['location', 'latitude']);
            $lng = self::pick($message, ['location', 'longitude']);

            return [($lat !== '' && $lng !== '') ? $lat . ',' . $lng : '', '', ''];
        }

        if ($type === 'reaction') return [self::pick($message, ['reaction', 'emoji']), '', ''];

        if ($type === 'contacts') {
            $cards = [];
            foreach (self::items($message, 'contacts') as $card) {
                $name = self::pick($card, ['name', 'formatted_name']);
                if ($name !== '') $cards[] = $name;
            }

            return [implode(', ', $cards), '', ''];
        }

        if ($type === 'system') return [self::pick($message, ['system', 'body']), '', ''];

        return ['', '', ''];
    }

    // -- Telefono --

    // 10 digitos si es de Mexico (521 + 10 o 52 + 10); de otro pais, los digitos tal cual.
    static function localPhone($waId) {
        $digits = preg_replace('/\D/', '', (string) $waId);
        if (strlen($digits) === 13 && strpos($digits, '521') === 0) return substr($digits, 3);
        if (strlen($digits) === 12 && strpos($digits, '52') === 0)  return substr($digits, 2);

        return $digits;
    }

    // -- Ayudantes --

    // El valor en esa ruta como texto; '' si falta o no es un valor simple.
    private static function pick($array, array $path) {
        foreach ($path as $key) {
            if (!is_array($array) || !array_key_exists($key, $array)) return '';
            $array = $array[$key];
        }

        if (is_string($array)) return trim($array);
        if (is_int($array) || is_float($array)) return (string) $array;

        return '';
    }

    // La lista en esa llave; [] si falta o no es lista.
    private static function items($array, $key) {
        if (!is_array($array) || !isset($array[$key]) || !is_array($array[$key])) return [];

        return array_values($array[$key]);
    }

    private static function cut($text, $max) {
        $text = (string) $text;

        return mb_strlen($text, 'UTF-8') > $max ? mb_substr($text, 0, $max, 'UTF-8') : $text;
    }

    // -- Log --

    // core/helpers/whatsapp.log, el mismo de los avisos. Nunca el secreto ni el token.
    static function log($message) {
        require_once __DIR__ . '/_Zona.php';

        @file_put_contents(__DIR__ . '/whatsapp.log', '[ ' . date('Y-m-d H:i:s') . " ] [ AGENTE ]\n" . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}
