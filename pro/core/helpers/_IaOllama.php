<?php
/*  IaOllama :: cliente minimo de Ollama Cloud (ollama.com) para el agente de
    WhatsApp de pro. Copia recortada de inventory/conf/_IaOllama.php: solo
    chatRonda() (una vuelta de un chat con herramientas); sin imagenes, sin
    tono y sin la tabla de CoffeeIA de inventory.

    Ollama Cloud es un servicio en la red, no el equipo de la oficina: lo que
    se le manda (el hilo del chat y lo que leen las herramientas) sale de
    nuestro servidor. La llave nunca va al navegador.

    De donde salen las llaves, en orden:
      1. pro/core/config/.env
      2. coffee/app/credentials/.env (el del visor; en local ya las tiene)
    Llaves: OLLAMA_API_KEY (sin ella, desdeEnv() da null), OLLAMA_BASE_URL,
    OLLAMA_TIMEOUT, OLLAMA_CA_BUNDLE y WHATSAPP_AGENT_MODEL (el modelo del
    agente; sin ella, MODELO).

    Medido el 16/11/2026 en el arnes de F3 (20 preguntas, datos de prueba):
    ver la decision 4 en app/order/docs/plan-agente-whatsapp.html. */
class IaOllama {

    const MODELO   = 'gpt-oss:120b-cloud';
    const ESFUERZO = 'low';

    private $key;
    private $url;
    private $ca;
    private $espera;
    private $modelo;
    private $esfuerzo;

    private function __construct(array $env, $modelo, $espera) {
        $this->key    = trim((string) $env['OLLAMA_API_KEY']);
        $this->url    = rtrim(trim((string) ($env['OLLAMA_BASE_URL'] ?? '')) ?: 'https://ollama.com', '/') . '/api/chat';
        $this->espera = $espera !== null ? max(10, (int) $espera) : max(30, (int) ($env['OLLAMA_TIMEOUT'] ?? 120));
        $this->modelo = trim((string) $modelo) ?: (trim((string) ($env['WHATSAPP_AGENT_MODEL'] ?? '')) ?: self::MODELO);
        $this->ca     = self::certificado($env);

        // El esfuerzo solo lo admite el modelo de la constante: a otro se le manda sin think (un nivel que no admite es un 400).
        $this->esfuerzo = $this->modelo === self::MODELO ? self::ESFUERZO : '';
    }

    /*  null si ningun .env trae OLLAMA_API_KEY: quien llama lo traduce a «el
        agente no esta configurado». $modelo fuerza un modelo (el arnes compara
        dos); $espera, los segundos maximos de cada llamada. */
    static function desdeEnv($modelo = null, $espera = null) {
        $rutas = [
            dirname(__DIR__) . '/config/.env',
            dirname(__DIR__, 3) . '/coffee/app/credentials/.env'
        ];

        foreach ($rutas as $ruta) {
            if (!is_readable($ruta)) continue;

            $env = @parse_ini_file($ruta, false, INI_SCANNER_TYPED);

            if (!is_array($env) || trim((string) ($env['OLLAMA_API_KEY'] ?? '')) === '') continue;

            // Solo lo de Ollama y el modelo del agente: lo demas del .env no se guarda aqui.
            $propio = [];
            foreach ($env as $k => $v) {
                if (strpos($k, 'OLLAMA_') === 0 || $k === 'WHATSAPP_AGENT_MODEL') $propio[$k] = $v;
            }

            return new IaOllama($propio, $modelo, $espera);
        }

        return null;
    }

    function modelo() {
        return $this->modelo;
    }

    /*  Una vuelta de un chat con herramientas; el bucle (ejecutar lo que pida y
        volver a preguntar) lo lleva quien llama. Devuelve
        ['ok', 'content', 'tool_calls', 'error']. */
    function chatRonda($mensajes, $tools = []) {
        // Ollama rechaza (400) unos argumentos vacios que vuelven como [] en vez de {}.
        foreach ($mensajes as &$m) {
            foreach ($m['tool_calls'] ?? [] as $i => $tc) {
                if (($tc['function']['arguments'] ?? null) === []) $m['tool_calls'][$i]['function']['arguments'] = (object) [];
            }
        }
        unset($m);

        $cuerpo = [
            'model'    => $this->modelo,
            'stream'   => false,
            'options'  => ['temperature' => 0.2],
            'messages' => $mensajes
        ];

        if ($tools) $cuerpo['tools'] = $tools;
        if ($this->esfuerzo !== '') $cuerpo['think'] = $this->esfuerzo;

        $r = $this->llamar($cuerpo);

        if ($r['error'] !== '') {
            $error = $tools && stripos($r['detalle'] ?? '', 'does not support tools') !== false
                ? 'El modelo del agente no sabe usar herramientas. Elige otro en WHATSAPP_AGENT_MODEL.'
                : $r['error'];

            return ['ok' => false, 'content' => '', 'tool_calls' => [], 'error' => $error];
        }

        $m = json_decode($r['cuerpo'], true)['message'] ?? [];

        return [
            'ok'         => true,
            'content'    => trim((string) ($m['content'] ?? '')),
            'tool_calls' => is_array($m['tool_calls'] ?? null) ? $m['tool_calls'] : [],
            'error'      => ''
        ];
    }

    // -- HTTP --

    private function llamar($cuerpo) {
        $ch = curl_init($this->url);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $this->key],
            CURLOPT_TIMEOUT        => $this->espera,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_POSTFIELDS     => json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)
        ]);

        if ($this->ca !== '') curl_setopt($ch, CURLOPT_CAINFO, $this->ca);

        $raw  = curl_exec($ch);
        $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);

        curl_close($ch);

        if ($raw === false || $err !== '') {
            self::anotar($cuerpo['model'] . ' · ' . $err);

            return ['cuerpo' => '', 'error' => 'El servicio de IA no respondió. Inténtalo en un momento.'];
        }

        if ($http >= 400) {
            self::anotar($cuerpo['model'] . ' · HTTP ' . $http . ' · ' . mb_substr((string) $raw, 0, 300));

            $msg = $http === 429 ? 'Se agotó la cuota del servicio de IA por ahora. Inténtalo más tarde.'
                 : ($http === 404 ? 'El modelo del agente no existe. Revisa WHATSAPP_AGENT_MODEL.'
                 : 'El servicio de IA respondió con un error (' . $http . ').');

            return ['cuerpo' => '', 'error' => $msg, 'detalle' => (string) $raw];
        }

        return ['cuerpo' => (string) $raw, 'error' => ''];
    }

    // En este WAMP php.ini no trae curl.cainfo: sin bundle el TLS con ollama.com falla.
    private static function certificado($env) {
        if (ini_get('curl.cainfo') || ini_get('openssl.cafile')) return '';

        $candidatos = [
            trim((string) ($env['OLLAMA_CA_BUNDLE'] ?? '')),
            dirname(__DIR__, 3) . '/coffee/app/credentials/cacert.pem',
            'C:/wamp64/credentials/cacert.pem'
        ];

        foreach ($candidatos as $ca) {
            if ($ca !== '' && is_readable($ca)) return $ca;
        }

        return '';
    }

    private static function anotar($texto) {
        error_log('[IaOllama pro] ' . date('Y-m-d H:i:s') . ' · ' . $texto);
    }
}
