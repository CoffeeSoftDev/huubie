<?php
/*  WHATSAPP DE META (Cloud API) para el agente: lo que llega al webhook y lo
    que se le contesta al cliente.

    Solo entiende a Meta: no toca la base. Lo usan
    app/order/ctrl/ctrl-whatsapp-webhook.php y la bandeja (ctrl-whatsapp.php).

        WHATSAPP_META_APP_SECRET     el secreto de la app de Meta (Configuracion de
                                     la app > Basica). Con el, Meta firma cada aviso.
        WHATSAPP_META_VERIFY_TOKEN   la palabra que se escribe igual en el panel de
                                     Meta al registrar el webhook.
        WHATSAPP_META_TOKEN          el token de acceso para ENVIAR (usuario del
                                     sistema de la cuenta de Meta). Sin el, todo
                                     envio es simulado: no sale a la red y queda
                                     con status 'simulated'.
        WHATSAPP_META_GRAPH_VERSION  opcional; la version de la Graph API (v23.0).

    Viven en pro/core/config/.env y nunca salen en el log ni en una respuesta.
    Sin secreto, signed() rechaza todo; sin token de verificacion, challenge()
    tambien.

    Los avisos al duenio (Green API / UltraMsg) siguen en _WhatsApp.php, sin
    cambios: este archivo es solo del agente. */
class WhatsAppMeta {
    const MAX_BODY = 1048576;   // bytes del aviso de Meta; mas grande = 413
    const MAX_TEXT = 4096;      // caracteres de body (lo mas largo que Meta deja escribir)
    const MAX_NAME = 120;       // caracteres del nombre del perfil (wa_chat.name)
    const MAX_RAW  = 65000;     // bytes de raw (columna TEXT); mas grande = no se guarda
    const MEDIA    = ['image', 'audio', 'video', 'document', 'sticker'];
    const STATUSES = ['sent', 'delivered', 'read', 'failed'];
    const GRAPH    = 'v23.0';

    private $secret;
    private $verifyToken;
    private $token;
    private $graph = self::GRAPH;

    /*  Plantillas aprobadas en Meta (F5): la clave de Huubie => [nombre en
        Meta, idioma]. El texto lo aprueba Meta; Huubie solo manda los valores.
        Los nombres se cambian en el .env (WHATSAPP_META_TPL_SALDO,
        WHATSAPP_META_TPL_ABRIMOS, WHATSAPP_META_TPL_TARJETA, WHATSAPP_META_TPL_PREMIO,
        WHATSAPP_META_TPL_IDIOMA). 'tarjeta' y 'premio' son de Lealtad (tarjeta
        digital y premio de sellos listo). */
    private $templates = [
        'saldo'   => ['name' => 'huubie_saldo_pendiente', 'lang' => 'es_MX'],
        'abrimos' => ['name' => 'huubie_ya_abrimos', 'lang' => 'es_MX'],
        'tarjeta' => ['name' => 'huubie_tarjeta_digital', 'lang' => 'es_MX'],
        'premio'  => ['name' => 'huubie_premio_listo', 'lang' => 'es_MX'],
    ];

    // Sin argumentos lee el .env. Con los tres (el arnes de pruebas) no lo toca.
    function __construct($secret = null, $verifyToken = null, $token = null) {
        if ($secret === null || $verifyToken === null || $token === null) {
            $env = $this->env();
            if ($secret === null)      $secret      = $env['WHATSAPP_META_APP_SECRET'] ?? '';
            if ($verifyToken === null) $verifyToken = $env['WHATSAPP_META_VERIFY_TOKEN'] ?? '';
            if ($token === null)       $token       = $env['WHATSAPP_META_TOKEN'] ?? '';

            $graph = $env['WHATSAPP_META_GRAPH_VERSION'] ?? '';
            if (preg_match('/^v\d{1,3}\.\d{1,2}$/', $graph)) $this->graph = $graph;

            $lang = $env['WHATSAPP_META_TPL_IDIOMA'] ?? '';
            foreach (['saldo' => 'WHATSAPP_META_TPL_SALDO', 'abrimos' => 'WHATSAPP_META_TPL_ABRIMOS', 'tarjeta' => 'WHATSAPP_META_TPL_TARJETA', 'premio' => 'WHATSAPP_META_TPL_PREMIO'] as $key => $var) {
                $name = $env[$var] ?? '';
                if (preg_match('/^[a-z0-9_]{1,512}$/', $name)) $this->templates[$key]['name'] = $name;
                if (preg_match('/^[a-z]{2,3}(_[A-Z]{2})?$/', $lang)) $this->templates[$key]['lang'] = $lang;
            }
        }

        $this->secret      = (string) $secret;
        $this->verifyToken = (string) $verifyToken;
        $this->token       = preg_match('/^\S+$/', (string) $token) ? (string) $token : '';
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

    /*  Lo que la pantalla puede saber, sin un solo valor del .env:
          simulated  sin WHATSAPP_META_TOKEN: nada sale a la red.
          ready      hay token y el webhook puede recibir (secreto y verificacion).
          missing    los NOMBRES de las llaves que faltan para recibir. */
    function status() {
        $missing = [];
        if ($this->secret === '')      $missing[] = 'WHATSAPP_META_APP_SECRET';
        if ($this->verifyToken === '') $missing[] = 'WHATSAPP_META_VERIFY_TOKEN';
        if ($this->token === '')       $missing[] = 'WHATSAPP_META_TOKEN';

        return [
            'provider'  => 'meta',
            'simulated' => $this->token === '',
            'ready'     => !$missing,
            'missing'   => $missing,
        ];
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
        Los "statuses" (entregado, leido) salen en statuses(). */
    static function incoming(array $payload) {
        $out = [];

        foreach (self::values($payload) as $value) {
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

        return $out;
    }

    /*  Cada cambio de estado de un mensaje que SALIO, ya plano:
          phone_number_id  el numero de la empresa que lo mando
          wamid            el provider_id que se guardo al enviarlo
          status           sent · delivered · read · failed
          at               unix; la hora de Meta, o la de ahora si no vino
          error            solo en failed: el codigo y el motivo de Meta (255 max)
          skip             '' = se aplica; si no, por que se ignora */
    static function statuses(array $payload) {
        $out = [];

        foreach (self::values($payload) as $value) {
            $number = self::pick($value, ['metadata', 'phone_number_id']);

            foreach (self::items($value, 'statuses') as $st) {
                $wamid  = self::pick($st, ['id']);
                $status = strtolower(self::pick($st, ['status']));
                $ts     = self::pick($st, ['timestamp']);

                $skip = '';
                if (!preg_match('/^\d{1,32}$/', $number))             $skip = 'sin phone_number_id';
                else if ($wamid === '' || strlen($wamid) > 128)       $skip = 'sin wamid';
                else if (!in_array($status, self::STATUSES, true))    $skip = 'estado desconocido';

                $error = null;
                if ($status === 'failed') {
                    $first = self::items($st, 'errors')[0] ?? [];
                    $parts = array_filter([
                        self::pick($first, ['code']),
                        self::pick($first, ['error_data', 'details']) ?: (self::pick($first, ['message']) ?: self::pick($first, ['title'])),
                    ], 'strlen');

                    $error = self::cut($parts ? implode(' · ', $parts) : 'Meta no dijo el motivo', 255);
                }

                $out[] = [
                    'phone_number_id' => $number,
                    'wamid'           => $wamid,
                    'status'          => $status,
                    'at'              => preg_match('/^\d{1,12}$/', $ts) ? (int) $ts : time(),
                    'error'           => $error,
                    'skip'            => $skip,
                ];
            }
        }

        return $out;
    }

    // El "value" de cada cambio del campo messages (ahi vienen mensajes y statuses).
    private static function values(array $payload) {
        $out = [];
        if (self::pick($payload, ['object']) !== 'whatsapp_business_account') return $out;

        foreach (self::items($payload, 'entry') as $entry) {
            foreach (self::items($entry, 'changes') as $change) {
                if (self::pick($change, ['field']) !== 'messages') continue;

                $out[] = (is_array($change) && isset($change['value']) && is_array($change['value'])) ? $change['value'] : [];
            }
        }

        return $out;
    }

    // -- Envio --

    /*  Un texto al cliente desde el numero de la empresa ($phoneNumberId).
        Devuelve ok, status (sent|failed|simulated), detail (el error),
        provider_id (el wamid que da Meta; null si no salio) y to.
        Sin WHATSAPP_META_TOKEN no sale a la red: 'simulated'. */
    function send($phoneNumberId, $phone, $text) {
        $to     = self::metaPhone($phone);
        $text   = trim((string) $text);
        $answer = ['ok' => false, 'status' => 'failed', 'detail' => '', 'provider_id' => null, 'to' => $to];

        if ($to === '')   return array_merge($answer, ['detail' => 'El teléfono del cliente no es válido.']);
        if ($text === '') return array_merge($answer, ['detail' => 'El mensaje está vacío.']);
        if (mb_strlen($text, 'UTF-8') > self::MAX_TEXT) return array_merge($answer, ['detail' => 'El mensaje pasa de ' . self::MAX_TEXT . ' caracteres.']);

        if ($this->token === '') return self::simulated($to);

        if (!preg_match('/^\d{1,32}$/', (string) $phoneNumberId)) {
            return array_merge($answer, ['detail' => 'El número de la empresa no tiene phone_number_id.']);
        }

        $url  = 'https://graph.facebook.com/' . $this->graph . '/' . $phoneNumberId . '/messages';
        $body = json_encode([
            'messaging_product' => 'whatsapp',
            'recipient_type'    => 'individual',
            'to'                => $to,
            'type'              => 'text',
            'text'              => ['preview_url' => false, 'body' => $text],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            $res = $this->request($url, $body);
        } catch (Throwable $e) {
            self::log('[ ENVIO ] :: ' . $e->getMessage());

            return array_merge($answer, ['detail' => 'No se pudo llamar a Meta.']);
        }

        $wamid = self::pick($res['body'] ?? null, ['messages', 0, 'id']);

        if ($res['code'] >= 200 && $res['code'] < 300 && $wamid !== '' && strlen($wamid) <= 128) {
            return array_merge($answer, ['ok' => true, 'status' => 'sent', 'provider_id' => $wamid]);
        }

        $detail = self::pick($res['body'] ?? null, ['error', 'message']);
        if ($detail === '') $detail = $res['error'] !== '' ? $res['error'] : 'Meta contestó HTTP ' . $res['code'] . '.';

        self::log('[ ENVIO ] :: HTTP ' . $res['code'] . ' · ' . $detail);

        return array_merge($answer, ['detail' => self::cut($detail, 255)]);
    }

    // Nombre e idioma de cada plantilla, para la pantalla (no son secretos).
    function templates() {
        return $this->templates;
    }

    /*  Una plantilla aprobada (F5): lo unico que Meta deja mandar fuera de la
        ventana de 24 h. $key = 'saldo' | 'abrimos' | 'tarjeta' | 'premio'; $params = los valores
        {{1}}, {{2}}… en orden. Meta no acepta saltos de linea ni tabuladores
        en un valor: se cambian por espacios. Devuelve lo mismo que send(). */
    function sendTemplate($phoneNumberId, $phone, $key, array $params) {
        $to     = self::metaPhone($phone);
        $tpl    = $this->templates[$key] ?? null;
        $answer = ['ok' => false, 'status' => 'failed', 'detail' => '', 'provider_id' => null, 'to' => $to];

        if ($to === '')  return array_merge($answer, ['detail' => 'El teléfono del cliente no es válido.']);
        if (!$tpl)       return array_merge($answer, ['detail' => 'Esa plantilla no existe.']);

        $values = [];

        foreach (array_values($params) as $value) {
            $value = trim((string) preg_replace('/\s+/u', ' ', (string) $value));
            if ($value === '') return array_merge($answer, ['detail' => 'A la plantilla le falta un dato.']);

            $values[] = ['type' => 'text', 'text' => self::cut($value, 1000)];
        }

        if ($this->token === '') return self::simulated($to);

        if (!preg_match('/^\d{1,32}$/', (string) $phoneNumberId)) {
            return array_merge($answer, ['detail' => 'El número de la empresa no tiene phone_number_id.']);
        }

        $url  = 'https://graph.facebook.com/' . $this->graph . '/' . $phoneNumberId . '/messages';
        $body = json_encode([
            'messaging_product' => 'whatsapp',
            'recipient_type'    => 'individual',
            'to'                => $to,
            'type'              => 'template',
            'template'          => [
                'name'       => $tpl['name'],
                'language'   => ['code' => $tpl['lang']],
                'components' => $values ? [['type' => 'body', 'parameters' => $values]] : [],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            $res = $this->request($url, $body);
        } catch (Throwable $e) {
            self::log('[ PLANTILLA ] :: ' . $e->getMessage());

            return array_merge($answer, ['detail' => 'No se pudo llamar a Meta.']);
        }

        $wamid = self::pick($res['body'] ?? null, ['messages', 0, 'id']);

        if ($res['code'] >= 200 && $res['code'] < 300 && $wamid !== '' && strlen($wamid) <= 128) {
            return array_merge($answer, ['ok' => true, 'status' => 'sent', 'provider_id' => $wamid]);
        }

        $detail = self::pick($res['body'] ?? null, ['error', 'message']);
        if ($detail === '') $detail = $res['error'] !== '' ? $res['error'] : 'Meta contestó HTTP ' . $res['code'] . '.';

        self::log('[ PLANTILLA ] :: ' . $tpl['name'] . ' · HTTP ' . $res['code'] . ' · ' . $detail);

        return array_merge($answer, ['detail' => self::cut($detail, 255)]);
    }

    // La respuesta de un envio que no sale a la red.
    static function simulated($to) {
        return ['ok' => true, 'status' => 'simulated', 'detail' => '', 'provider_id' => null, 'to' => (string) $to];
    }

    // -- Archivos que mando el cliente --

    /*  Baja una foto o un documento que llego al webhook (media_id). Meta da
        primero una url temporal (5 min) y luego los bytes, las dos con el token.
        Devuelve ok, bytes, mime y detail. Sin token o mas de $max bytes = ok false. */
    function media($mediaId, $max = 5242880) {
        $answer = ['ok' => false, 'bytes' => '', 'mime' => '', 'detail' => ''];

        if ($this->token === '') return array_merge($answer, ['detail' => 'Sin token de Meta no se pueden bajar archivos.']);
        if (!preg_match('/^\d{1,64}$/', (string) $mediaId)) return array_merge($answer, ['detail' => 'El archivo no tiene un id de Meta.']);

        try {
            $info = $this->fetch('https://graph.facebook.com/' . $this->graph . '/' . $mediaId, 2048);
            $meta = $info['code'] === 200 ? json_decode($info['raw'], true) : null;
            $url  = self::pick($meta, ['url']);
            $size = (int) self::pick($meta, ['file_size']);

            if (!preg_match('~^https://[^\s]+$~', $url)) return array_merge($answer, ['detail' => 'Meta no dio el archivo (HTTP ' . $info['code'] . ').']);
            if ($size > $max)                            return array_merge($answer, ['detail' => 'El archivo pesa más de ' . round($max / 1048576) . ' MB.']);

            $file = $this->fetch($url, $max + 1);
        } catch (Throwable $e) {
            self::log('[ ARCHIVO ] :: ' . $e->getMessage());

            return array_merge($answer, ['detail' => 'No se pudo bajar el archivo de Meta.']);
        }

        if ($file['code'] !== 200 || $file['raw'] === '') return array_merge($answer, ['detail' => 'Meta no dio el archivo (HTTP ' . $file['code'] . ').']);
        if (strlen($file['raw']) > $max)                   return array_merge($answer, ['detail' => 'El archivo pesa más de ' . round($max / 1048576) . ' MB.']);

        return ['ok' => true, 'bytes' => $file['raw'], 'mime' => self::pick($meta, ['mime_type']), 'detail' => ''];
    }

    // GET con el token; corta en $max bytes. El token nunca va al log.
    protected function fetch($url, $max) {
        $curl = curl_init();
        $raw  = '';

        curl_setopt_array($curl, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->token],
            CURLOPT_WRITEFUNCTION  => function ($ch, $chunk) use (&$raw, $max) {
                if (strlen($raw) + strlen($chunk) > $max) return 0;

                $raw .= $chunk;

                return strlen($chunk);
            },
        ]);

        curl_exec($curl);
        $code = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        return ['code' => $code, 'raw' => $raw];
    }

    // [code, error, body]. El token va en el encabezado y nunca al log.
    protected function request($url, $payload) {
        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->token,
            ],
        ]);

        $raw   = curl_exec($curl);
        $error = curl_error($curl);
        $code  = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        return [
            'code'  => $code,
            'error' => (string) $error,
            'body'  => is_string($raw) && $raw !== '' ? json_decode($raw, true) : null,
        ];
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

    // Como lo pide Meta para enviar: Mexico = 52 + 10 digitos; de otro pais, sus digitos.
    static function metaPhone($phone) {
        $digits = preg_replace('/\D/', '', (string) $phone);

        if (strlen($digits) === 10) return '52' . $digits;
        if (strlen($digits) === 13 && strpos($digits, '521') === 0) return '52' . substr($digits, 3);
        if (strlen($digits) >= 8 && strlen($digits) <= 15) return $digits;

        return '';
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
