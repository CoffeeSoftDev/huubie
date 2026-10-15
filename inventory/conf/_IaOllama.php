<?php
/*  IaOllama :: cliente minimo de Ollama Cloud para los asistentes de inventory.

    La llave NO vive aqui: se lee del .env que ya usa el visor
    (coffee/app/credentials/.env), junto con su cacert.pem. Se queda en el
    servidor y nunca viaja al navegador.

    Hace cuatro cosas:
    - chatJson(): pregunta y exige la respuesta en JSON (format: "json"); si
      contesta en prosa, se lo vuelve a pedir una vez.
    - chatRonda(): una vuelta de un chat con herramientas (tools de Ollama);
      el bucle lo lleva quien llama (CoffeeIA de Pedidos).
    - transcribirImagen(): pasa una foto a texto con un modelo que ve. El de
      texto no admite imagenes, asi que la foto se transcribe antes y lo que
      sigue ya es texto. Mismo camino que coffeeIA de erp-pro (mirarImagen).
    - mirarImagen(): lo mismo con otra instruccion (el editor de temas la
      usa para describir el logo de una marca).

    Quien manda, en orden: la configuracion global de coffeeIA (Administrador >
    CoffeeIA, tabla fayxzvov_erp.coffeeia_config), el .env (IA_PRODUCTOS_MODEL,
    IA_PRODUCTOS_THINK, IA_VISION_MODEL) y al final las constantes. Lo que en la
    tabla queda en NULL ("Predeterminado") pasa al siguiente. El tono de esa
    misma tabla se suma a las instrucciones de cada chat.

    Medido el 23/09/2026 con el catalogo real (126 productos, ~5.000 tokens de
    prompt), tres corridas cada uno y la misma respuesta correcta:
        gpt-oss:120b-cloud, think "low"   1,2 a 1,4 s
        glm-5.2:cloud                     4 a 39 s (y 26 s con think:false)
    La diferencia es la latencia del servicio, no la calidad.
*/
class IaOllama {

    const MODELO   = 'gpt-oss:120b-cloud';
    const ESFUERZO = 'low';
    const VISION   = 'kimi-k2.7-code';

    private $key;
    private $url;
    private $ca;
    private $espera;
    private $modelo;
    private $esfuerzo;
    private $vision;
    private $tono;

    private function __construct($env, $ajustes) {
        $this->key    = trim((string) $env['OLLAMA_API_KEY']);
        $this->url    = rtrim((string) ($env['OLLAMA_BASE_URL'] ?? 'https://ollama.com'), '/') . '/api/chat';
        $this->espera = max(30, (int) ($env['OLLAMA_TIMEOUT'] ?? 120));
        $this->modelo = trim((string) ($ajustes['model'] ?? '')) ?: (trim((string) ($env['IA_PRODUCTOS_MODEL'] ?? '')) ?: self::MODELO);
        $this->vision = trim((string) ($ajustes['vision_model'] ?? '')) ?: (trim((string) ($env['IA_VISION_MODEL'] ?? '')) ?: self::VISION);
        $this->tono   = trim((string) ($ajustes['tone'] ?? ''));
        $this->ca     = self::certificado($env);

        // El esfuerzo solo se manda si el modelo lo admite: con otro modelo y sin
        // esfuerzo elegido (tabla o IA_PRODUCTOS_THINK) no se manda nada (un nivel
        // que no admite es un 400).
        $esfuerzo = trim((string) ($ajustes['effort'] ?? ''));

        $this->esfuerzo = $esfuerzo !== '' ? $esfuerzo
            : (isset($env['IA_PRODUCTOS_THINK'])
                ? trim((string) $env['IA_PRODUCTOS_THINK'])
                : ($this->modelo === self::MODELO ? self::ESFUERZO : ''));
    }

    // null si no hay .env o no trae llave; quien llama lo traduce a "no esta configurado".
    // $db: el ctrl que llama (hereda de CRUD) para leer la configuracion global;
    // sin el, manda solo el .env.
    static function desdeCredenciales($db = null) {
        $ruta = dirname(__DIR__, 2) . '/coffee/app/credentials/.env';

        if (!is_readable($ruta)) return null;

        $env = @parse_ini_file($ruta, false, INI_SCANNER_TYPED);

        if (!is_array($env) || trim((string) ($env['OLLAMA_API_KEY'] ?? '')) === '') return null;

        return new IaOllama($env, self::ajustes($db));
    }

    // La fila unica de Administrador > CoffeeIA. Si la tabla aun no existe
    // (migracion 2026-09-30_coffeeia-config.sql pendiente), _Read devuelve [].
    private static function ajustes($db) {
        if (!is_object($db) || !method_exists($db, '_Read')) return [];

        $r = $db->_Read("SELECT tone, model, effort, vision_model FROM fayxzvov_erp.coffeeia_config WHERE id = ? LIMIT 1", [1]);

        return is_array($r) && !empty($r) ? $r[0] : [];
    }

    // Encendido o apagado en Administrador > CoffeeIA: el ícono de la navbar y el
    // chat de Catálogo, Entradas y Salidas. Sin la fila o sin la columna (migración
    // 2026-10-06_coffeeia-activo.sql pendiente) se queda encendido, como estaba.
    static function activo($db) {
        if (!is_object($db) || !method_exists($db, '_Read')) return true;

        $r = $db->_Read("SELECT active FROM fayxzvov_erp.coffeeia_config WHERE id = ? LIMIT 1", [1]);

        return !(is_array($r) && !empty($r) && (int) $r[0]['active'] === 0);
    }

    // Devuelve ['ok', 'data', 'error']. 'data' es el objeto JSON ya decodificado.
    // En un hilo largo (historial en prosa y adjuntos de cientos de renglones) el modelo
    // olvida el formato que pide el system y contesta platicando, aunque vaya
    // format:"json" (15/10/2026, glm-5.3-flash): por eso el recordatorio al final y,
    // si aun así platica, una segunda vuelta pidiéndole lo mismo en JSON.
    function chatJson($mensajes) {
        $mensajes = $this->conTono($mensajes);
        $ultimo   = count($mensajes) - 1;

        if ($ultimo >= 0 && ($mensajes[$ultimo]['role'] ?? '') === 'user') {
            $mensajes[$ultimo]['content'] .= "\n\nRecuerda: contesta SOLO con el objeto JSON del formato que te pedí, sin texto antes ni después, aunque solo te hagan una pregunta.";
        }

        for ($vuelta = 1; $vuelta <= 2; $vuelta++) {
            $cuerpo = [
                'model'    => $this->modelo,
                'stream'   => false,
                'format'   => 'json',
                'options'  => ['temperature' => 0.1],
                'messages' => $mensajes
            ];

            if ($this->esfuerzo !== '') $cuerpo['think'] = $this->esfuerzo === 'off' ? false : $this->esfuerzo;

            $r = $this->llamar($cuerpo);

            if ($r['error'] !== '') return ['ok' => false, 'data' => null, 'error' => $r['error']];

            $j     = json_decode($r['cuerpo'], true);
            $texto = trim((string) ($j['message']['content'] ?? ''));
            $data  = self::extraerJson($texto);

            if ($data !== null) return ['ok' => true, 'data' => $data, 'error' => ''];

            self::anotar('chatJson · respuesta sin JSON (vuelta ' . $vuelta . ') · ' . mb_substr($texto, 0, 200));

            if ($vuelta === 2) break;

            // La segunda vuelta trae su propio tiempo: en Windows el reloj de PHP cuenta la espera de curl.
            set_time_limit($this->espera + 60);

            if ($texto !== '') $mensajes[] = ['role' => 'assistant', 'content' => $texto];

            $mensajes[] = ['role' => 'user', 'content' => 'Tu respuesta no vino en JSON. Repítela igual, pero como el objeto JSON del formato que te pedí, sin texto antes ni después.'];
        }

        return ['ok' => false, 'data' => null, 'error' => 'No entendí mi propia respuesta. Pídemelo otra vez, con otras palabras.'];
    }

    // Una vuelta de un chat con herramientas; el bucle (ejecutar lo que pida y volver a
    // preguntar) lo lleva quien llama. Texto libre, sin format json. Devuelve
    // ['ok', 'content', 'tool_calls', 'error'].
    function chatRonda($mensajes, $tools = []) {
        // Ollama rechaza (400) unos argumentos vacíos que vuelven como [] en vez de {}.
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
            'messages' => $this->conTono($mensajes)
        ];

        if ($tools) $cuerpo['tools'] = $tools;
        if ($this->esfuerzo !== '') $cuerpo['think'] = $this->esfuerzo === 'off' ? false : $this->esfuerzo;

        $r = $this->llamar($cuerpo);

        if ($r['error'] !== '') {
            $error = $tools && stripos($r['detalle'] ?? '', 'does not support tools') !== false
                ? 'El modelo configurado en Administrador > CoffeeIA no sabe usar herramientas. Elige otro.'
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

    // El tono va justo despues de las instrucciones del chat: las matiza, no las
    // reemplaza, y no toca el formato que cada chat exige.
    private function conTono($mensajes) {
        if ($this->tono === '') return $mensajes;

        array_splice($mensajes, 1, 0, [[
            'role'    => 'system',
            'content' => 'Tono de tus respuestas: ' . $this->tono . "\n"
                       . 'Aplica solo a cómo redactas el texto que lee la persona. No cambia el formato de la respuesta ni las reglas anteriores.'
        ]]);

        return $mensajes;
    }

    // Transcribe, no interpreta: la interpretacion es del modelo de texto, que
    // tiene el catalogo delante. Devuelve ['texto', 'aviso'].
    // $marcarDudas: la palabra que se lee a medias sale con (?) pegado (Entradas lo
    // usa para avisar de la letra dudosa; Catálogo no, o crearía nombres con "(?)").
    function transcribirImagen($ruta, $marcarDudas = false) {
        return $this->mirarImagen($ruta,
            "Transcribe esta imagen para alguien que no la puede ver.\n\n"
            . "- Si tiene texto, TRANSCRÍBELO COMPLETO y literal: nombres, cantidades, precios y claves tal como aparecen.\n"
            . "- Si es una lista, tabla, ticket o menú, pon un renglón por producto con sus columnas separadas por \" | \".\n"
            . "- No opines, no resumas y no completes lo que no se ve. Si algo no se lee, escribe [ilegible].\n"
            . ($marcarDudas ? "- Si una palabra se lee a medias (letra a mano, borrosa o cortada), escribe lo que más se parece y ponle (?) pegado al final, ej. \"Azucar(?)\".\n" : '')
            . "\nContesta en español."
        );
    }

    // La imagen con la instruccion de quien llama (transcribir un ticket,
    // describir una marca...). Devuelve ['texto', 'aviso'].
    function mirarImagen($ruta, $instruccion) {
        $b64 = self::imagenBase64($ruta);

        if ($b64 === null) return ['texto' => '', 'aviso' => 'No pude abrir esa imagen. Vuelve a guardarla como JPG o PNG.'];

        $r = $this->llamar([
            'model'    => $this->vision,
            'stream'   => false,
            'options'  => ['temperature' => 0.1],
            'messages' => [[
                'role'    => 'user',
                'content' => $instruccion,
                'images'  => [$b64]
            ]]
        ]);

        if ($r['error'] !== '') return ['texto' => '', 'aviso' => 'No pude mirar la imagen: ' . $r['error']];

        $j     = json_decode($r['cuerpo'], true);
        $texto = trim((string) ($j['message']['content'] ?? ''));

        if ($texto === '') return ['texto' => '', 'aviso' => 'Miré la imagen pero no pude sacar nada en claro.'];

        return ['texto' => mb_substr($texto, 0, 30000), 'aviso' => ''];
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
                 : ($http === 404 ? 'El modelo de IA configurado no existe. Avisa a sistemas.'
                 : 'El servicio de IA respondió con un error (' . $http . ').');

            return ['cuerpo' => '', 'error' => $msg, 'detalle' => (string) $raw];
        }

        return ['cuerpo' => (string) $raw, 'error' => ''];
    }

    // Aunque se pida format:"json", algunos modelos envuelven la respuesta en
    // ```json ... ```. Se prueba entero y, si no, del primer { al ultimo }.
    private static function extraerJson($texto) {
        $d = json_decode($texto, true);

        if (is_array($d)) return $d;

        $a = strpos($texto, '{');
        $b = strrpos($texto, '}');

        if ($a === false || $b === false || $b <= $a) return null;

        $d = json_decode(substr($texto, $a, $b - $a + 1), true);

        return is_array($d) ? $d : null;
    }

    // En este WAMP php.ini no trae curl.cainfo: sin bundle el TLS con ollama.com falla.
    private static function certificado($env) {
        if (ini_get('curl.cainfo') || ini_get('openssl.cafile')) return '';

        $candidatos = [
            trim((string) ($env['OLLAMA_CA_BUNDLE'] ?? '')),
            dirname(__DIR__, 2) . '/coffee/app/credentials/cacert.pem',
            'C:/wamp64/credentials/cacert.pem'
        ];

        foreach ($candidatos as $ca) {
            if ($ca !== '' && is_readable($ca)) return $ca;
        }

        return '';
    }

    // La foto encogida a 1600 px en el lado largo (la letra chica de un ticket se
    // sigue leyendo) y en el formato que pese menos: JPEG para fotos, PNG para capturas.
    private static function imagenBase64($ruta) {
        $crudo = @file_get_contents($ruta);

        if ($crudo === false || $crudo === '') return null;

        if (!function_exists('imagecreatefromstring')) return base64_encode($crudo);

        $medida = @getimagesize($ruta);

        // GD trabaja la imagen descomprimida (4 bytes por pixel, dos lienzos a la vez):
        // si no cabe en memoria se manda tal cual en vez de arriesgar un fatal.
        if ($medida !== false && !self::cabeEnMemoria($medida[0], $medida[1])) return base64_encode($crudo);

        $im = @imagecreatefromstring($crudo);

        if ($im === false) return null;

        $crudo = '';
        $an    = imagesx($im);
        $al    = imagesy($im);
        $max   = 1600;

        if ($an > $max || $al > $max) {
            $k  = $an > $al ? $max / $an : $max / $al;
            $nu = @imagescale($im, (int) round($an * $k), (int) round($al * $k));

            if ($nu !== false) { imagedestroy($im); $im = $nu; }
        }

        $fondo = imagecreatetruecolor(imagesx($im), imagesy($im));

        imagefill($fondo, 0, 0, imagecolorallocate($fondo, 255, 255, 255));
        imagecopy($fondo, $im, 0, 0, 0, 0, imagesx($im), imagesy($im));
        imagedestroy($im);

        ob_start();
        imagejpeg($fondo, null, 85);
        $jpg = (string) ob_get_clean();

        ob_start();
        imagepng($fondo, null, 6);
        $png = (string) ob_get_clean();

        imagedestroy($fondo);

        if ($jpg === '' && $png === '') return null;

        return base64_encode($png !== '' && ($jpg === '' || strlen($png) < strlen($jpg)) ? $png : $jpg);
    }

    private static function cabeEnMemoria($an, $al) {
        $tope = trim((string) ini_get('memory_limit'));

        if ($tope === '' || $tope === '-1') return true;

        $n = (int) $tope;

        switch (strtolower(substr($tope, -1))) {
            case 'g': $n *= 1073741824; break;
            case 'm': $n *= 1048576;    break;
            case 'k': $n *= 1024;       break;
        }

        return ($n - memory_get_usage(true)) > $an * $al * 4 * 2;
    }

    private static function anotar($texto) {
        error_log('[IaOllama] ' . date('Y-m-d H:i:s') . ' · ' . $texto);
    }
}
