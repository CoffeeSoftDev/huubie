<?php
/*  WHATSAPP SALIENTE. El mismo envio que alpha/conf/_Message.php (aviso(),
    fillTemplate(), sendGreenApi(), sendUltraMsg(), post()), con una diferencia:
    alla el proveedor y su token viven en la tabla wa_config; aqui viven en
    pro/core/config/.env y la base nunca los ve.

        WHATSAPP_PROVEEDOR   greenapi | ultramsg | simulado
        GREENAPI_INSTANCIA   el idInstance (solo numeros)
        GREENAPI_TOKEN       el apiTokenInstance
        GREENAPI_URL         opcional; https://api.green-api.com si va vacio
        ULTRAMSG_INSTANCIA   instance12345
        ULTRAMSG_TOKEN       el token de la instancia

    Sin WHATSAPP_PROVEEDOR (o con «simulado») no sale nada a la red: send()
    contesta como si hubiera salido y el historial lo marca «simulado». Es el
    modo de local y de pruebas.

    Ningun metodo lanza excepcion ni imprime: lo llaman ctrl que contestan JSON.
    El token va en la URL de Green API: ni la URL ni el token se escriben en el
    log ni salen en una respuesta. */
class WhatsApp {
    const SIMULATED = 'simulado';
    const PROVIDERS = ['greenapi', 'ultramsg', 'simulado'];

    private $env = null;

    // -- .env --

    private function env() {
        if ($this->env !== null) return $this->env;

        $ruta = __DIR__ . '/../config/.env';
        $env  = is_file($ruta) ? @parse_ini_file($ruta) : false;

        $this->env = [];
        if (!is_array($env)) return $this->env;

        foreach ($env as $key => $value) {
            if (strpos($key, 'WHATSAPP_') === 0 || strpos($key, 'GREENAPI_') === 0 || strpos($key, 'ULTRAMSG_') === 0) {
                $this->env[$key] = trim((string) $value);
            }
        }

        return $this->env;
    }

    // greenapi, ultramsg o simulado. Un valor que no es ninguno de los tres cuenta como simulado.
    function provider() {
        $provider = strtolower($this->env()['WHATSAPP_PROVEEDOR'] ?? '');
        return in_array($provider, self::PROVIDERS, true) ? $provider : self::SIMULATED;
    }

    // Lo que necesita el proveedor elegido, ya validado. null si falta algo.
    private function config() {
        $env      = $this->env();
        $provider = $this->provider();

        if ($provider === 'greenapi') {
            $url = $env['GREENAPI_URL'] ?? '';
            return [
                'provider' => 'greenapi',
                'instance' => $env['GREENAPI_INSTANCIA'] ?? '',
                'token'    => $env['GREENAPI_TOKEN'] ?? '',
                'api_url'  => $url !== '' ? $url : 'https://api.green-api.com',
            ];
        }

        if ($provider === 'ultramsg') {
            return [
                'provider' => 'ultramsg',
                'instance' => $env['ULTRAMSG_INSTANCIA'] ?? '',
                'token'    => $env['ULTRAMSG_TOKEN'] ?? '',
            ];
        }

        return ['provider' => self::SIMULATED];
    }

    /*  Que falta para poder mandar, sin enseñar ningun valor: la pagina de
        WhatsApp lo pinta en «Conexión». */
    function status() {
        $config  = $this->config();
        $missing = [];
        $prefix  = $config['provider'] === 'greenapi' ? 'GREENAPI_' : 'ULTRAMSG_';

        if ($config['provider'] !== self::SIMULATED) {
            if (!preg_match('/^[A-Za-z0-9_-]+$/', $config['instance'])) $missing[] = $prefix . 'INSTANCIA';
            if (!preg_match('/^[A-Za-z0-9_-]+$/', $config['token']))    $missing[] = $prefix . 'TOKEN';

            if ($config['provider'] === 'greenapi' && stripos($config['api_url'], 'https://') !== 0) {
                $missing[] = 'GREENAPI_URL';
            }
        }

        return [
            'provider'  => $config['provider'],
            'simulated' => $config['provider'] === self::SIMULATED,
            'ready'     => $config['provider'] !== self::SIMULATED && !$missing,
            'missing'   => $missing,
        ];
    }

    // -- Envio --

    /*  Un texto a un telefono de 10 digitos o a un grupo (…@g.us).
        Devuelve ok, status (sent|failed|simulated), detail (el error, para el
        historial), provider y to (como lo recibio el proveedor). */
    function send($phone, $text) {
        $config = $this->config();
        $phone  = self::phone($phone);
        $answer = ['ok' => false, 'status' => 'failed', 'detail' => '', 'provider' => $config['provider'], 'to' => $phone];

        if ($phone === '') return array_merge($answer, ['detail' => 'El teléfono no es de 10 dígitos ni un grupo.']);
        if (trim((string) $text) === '') return array_merge($answer, ['detail' => 'El mensaje está vacío.']);

        if ($config['provider'] === self::SIMULATED) {
            return array_merge($answer, ['ok' => true, 'status' => 'simulated']);
        }

        $status = $this->status();
        if ($status['missing']) {
            return array_merge($answer, ['detail' => 'Faltan datos en el .env: ' . implode(', ', $status['missing']) . '.']);
        }

        $to = $this->providerRecipient($config['provider'], $phone);

        try {
            $sent = $config['provider'] === 'greenapi'
                ? $this->sendGreenApi($config, $to, $text)
                : $this->sendUltraMsg($config, $to, $text);
        } catch (Throwable $e) {
            $this->writeToLog("[ WHATSAPP send ] :: " . $e->getMessage());
            $sent = ['ok' => false, 'detalle' => 'No se pudo llamar al proveedor.'];
        }

        return array_merge($answer, [
            'ok'     => $sent['ok'],
            'status' => $sent['ok'] ? 'sent' : 'failed',
            'detail' => $sent['ok'] ? '' : mb_substr((string) $sent['detalle'], 0, 255, 'UTF-8'),
            'to'     => $to,
        ]);
    }

    /*  ¿La instancia esta conectada a un telefono? Green API: getStateInstance
        («authorized» = lista). UltraMsg: instance/status. No manda mensajes. */
    function check() {
        $config = $this->config();
        $status = $this->status();

        if ($config['provider'] === self::SIMULATED) return ['ok' => true, 'state' => 'simulado', 'detail' => 'Modo simulado: no se conecta a nadie.'];
        if ($status['missing']) return ['ok' => false, 'state' => '', 'detail' => 'Faltan datos en el .env: ' . implode(', ', $status['missing']) . '.'];

        if ($config['provider'] === 'greenapi') {
            $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/getStateInstance/' . $config['token'];
            $res = $this->request($url);

            if ($res['error'] !== '') return ['ok' => false, 'state' => '', 'detail' => 'No hubo respuesta de la API URL.'];

            $state = (string) ($res['body']['stateInstance'] ?? '');
            if ($state === '') return ['ok' => false, 'state' => '', 'detail' => 'Respuesta inesperada (HTTP ' . $res['code'] . ').'];

            return ['ok' => $state === 'authorized', 'state' => $state, 'detail' => $state === 'authorized' ? '' : 'La instancia no está vinculada a un teléfono.'];
        }

        $url = 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/instance/status?token=' . rawurlencode($config['token']);
        $res = $this->request($url);

        if ($res['error'] !== '') return ['ok' => false, 'state' => '', 'detail' => 'No hubo respuesta de api.ultramsg.com.'];
        if (isset($res['body']['error'])) {
            $detail = $res['body']['error'];
            return ['ok' => false, 'state' => '', 'detail' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
        }

        $state = (string) ($res['body']['status']['accountStatus']['status'] ?? '');
        return ['ok' => $state === 'authenticated', 'state' => $state, 'detail' => $state === 'authenticated' ? '' : 'La instancia no está vinculada a un teléfono.'];
    }

    // -- Telefono --

    /*  10 digitos (se quitan espacios, guiones y un 52/521 al frente) o un grupo
        …@g.us tal cual. '' si no es ninguno. */
    static function phone($raw) {
        $raw = trim((string) $raw);
        if (preg_match('/^[0-9-]+@g\.us$/', $raw)) return $raw;

        $digits = preg_replace('/\D/', '', $raw);
        if (strlen($digits) === 13 && strpos($digits, '521') === 0) $digits = substr($digits, 3);
        if (strlen($digits) === 12 && strpos($digits, '52') === 0)  $digits = substr($digits, 2);

        return strlen($digits) === 10 ? $digits : '';
    }

    // Mismo formato que alpha: UltraMsg +52…, Green API 521…@c.us. Los grupos pasan igual.
    private function providerRecipient($provider, $phone) {
        if (substr($phone, -5) === '@g.us') return $phone;

        return $provider === 'greenapi' ? '521' . $phone . '@c.us' : '+52' . $phone;
    }

    // -- Plantilla --

    /*  Igual que alpha (fillTemplate). Reemplaza {variable} con $vars. El
        renglon cuyas variables llegan todas vacias no sale; si eso deja un
        titulo *SECCION* sin renglones debajo, tampoco sale. Un monto en cero
        llega como "-" y se lleva el "$" de la plantilla. */
    static function fill($body, $vars) {
        $hasValue = function ($key) use ($vars) {
            return isset($vars[$key]) && trim((string) $vars[$key]) !== '';
        };

        $lines = [];

        // Saltos explicitos: \R sin /u toma el byte 0x85 de algunos emojis como salto.
        foreach (preg_split('/\r\n|\r|\n/', (string) $body) as $line) {
            $keys = preg_match_all('/\{(\w+)\}/', $line, $found) ? $found[1] : [];
            if ($keys && !array_filter($keys, $hasValue)) continue;

            $line = preg_replace_callback('/ ?\(\{(\w+)\}\)/', function ($match) use ($vars, $hasValue) {
                return (!$hasValue($match[1]) || (string) $vars[$match[1]] === '-') ? '' : $match[0];
            }, $line);

            $lines[] = preg_replace_callback('/(\$?)\{(\w+)\}/', function ($match) use ($vars, $hasValue) {
                if (!$hasValue($match[2])) return '';

                $value = (string) $vars[$match[2]];
                return $value === '-' ? '-' : $match[1] . $value;
            }, $line);
        }

        $text = [];

        foreach ($lines as $index => $line) {
            $blank = trim($line) === '';
            $next  = trim($lines[$index + 1] ?? '');

            if (!$blank && $next === '' && preg_match('/^\*[^*]+\*$/', trim($line))) continue;
            if ($blank && (empty($text) || trim(end($text)) === '')) continue;

            $text[] = $line;
        }

        return rtrim(implode("\n", $text));
    }

    // -- Proveedores --

    // Green API: sendMessage responde {idMessage} cuando el mensaje entra a la cola.
    private function sendGreenApi($config, $to, $text) {
        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/sendMessage/' . $config['token'];
        $res = $this->request($url, json_encode(['chatId' => $to, 'message' => $text], JSON_UNESCAPED_UNICODE), 'application/json');

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL.'];
        if (!empty($res['body']['idMessage'])) return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    // UltraMsg: messages/chat responde {sent: "true"} o {error: …}.
    private function sendUltraMsg($config, $to, $text) {
        $url = 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/messages/chat';
        $res = $this->request($url, http_build_query([
            'token'    => $config['token'],
            'to'       => $to,
            'priority' => '10',
            'body'     => $text,
        ]), 'application/x-www-form-urlencoded');

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];

        $sent = $res['body']['sent'] ?? '';
        if ($sent === true || $sent === 'true') return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['error'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
    }

    /*  POST si trae $payload, GET si no. La URL lleva el token: nunca se
        escribe en el log. 20 s de espera: lo llama el cierre de turno y el
        cobro, que esperan la respuesta. */
    private function request($url, $payload = null, $contentType = 'application/json') {
        $curl = curl_init();

        $options = [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_SSL_VERIFYPEER => 0,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ];

        if ($payload !== null) {
            $options[CURLOPT_POST]       = true;
            $options[CURLOPT_POSTFIELDS] = $payload;
            $options[CURLOPT_HTTPHEADER] = ['Accept: application/json', 'Content-Type: ' . $contentType];
        }

        curl_setopt_array($curl, $options);

        $raw   = curl_exec($curl);
        $error = curl_error($curl);
        $code  = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
        curl_close($curl);

        return [
            'code'  => $code,
            'error' => $error,
            'body'  => $raw ? json_decode($raw, true) : null,
        ];
    }

    // Aparte de mail.log. No se sirve por web (pro/.htaccess bloquea .log).
    function writeToLog($message) {
        require_once(__DIR__ . '/_Zona.php');

        file_put_contents(__DIR__ . '/whatsapp.log', "[ " . date('Y-m-d H:i:s') . " ]\n" . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}
?>
