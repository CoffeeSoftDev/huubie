<?php
/*  WHATSAPP SALIENTE. El mismo envio que alpha/conf/_Message.php (aviso(),
    fillTemplate(), sendGreenApi(), sendUltraMsg(), post(), y las fotos:
    shrinkImage(), uploadGreenApi(), splitCaption()), con una diferencia:
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
        $photo = una foto ya lista con photos(): sale la foto y $text va de pie.
        Devuelve ok, status (sent|failed|simulated), detail (el error, para el
        historial), provider y to (como lo recibio el proveedor). */
    function send($phone, $text, $photo = null) {
        $config = $this->config();
        $phone  = self::phone($phone);
        $answer = ['ok' => false, 'status' => 'failed', 'detail' => '', 'provider' => $config['provider'], 'to' => $phone];

        if ($phone === '') return array_merge($answer, ['detail' => 'El teléfono no es de 10 dígitos ni un grupo.']);
        if (!$photo && trim((string) $text) === '') return array_merge($answer, ['detail' => 'El mensaje está vacío.']);
        if ($photo && $photo['bytes'] === false) return array_merge($answer, ['detail' => 'La foto ya no está en el servidor.']);

        if ($config['provider'] === self::SIMULATED) {
            return array_merge($answer, ['ok' => true, 'status' => 'simulated']);
        }

        $status = $this->status();
        if ($status['missing']) {
            return array_merge($answer, ['detail' => 'Faltan datos en el .env: ' . implode(', ', $status['missing']) . '.']);
        }

        // Green API la subio una vez en photos(): si ahi fallo, no hay URL que mandar.
        if ($photo && $photo['remote'] && !$photo['remote']['ok']) {
            return array_merge($answer, ['detail' => mb_substr((string) $photo['remote']['detalle'], 0, 255, 'UTF-8')]);
        }

        $to = $this->providerRecipient($config['provider'], $phone);

        try {
            $sent = $config['provider'] === 'greenapi'
                ? $this->sendGreenApi($config, $to, $text, $photo)
                : $this->sendUltraMsg($config, $to, $text, $photo);
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

    // -- Fotos --

    /*  Las fotos de un aviso, listas una sola vez para todos los destinatarios
        (el aviso() de alpha). $photos: [file (ruta en disco), name, caption,
        reference]. Cada una regresa con bytes (false si ya no esta) y remote:
        con Green API se sube una vez a su almacenamiento (uploadFile) y a cada
        numero le llega por URL; UltraMsg la recibe en base64 en cada envio.
        La foto viaja como archivo, no como URL nuestra: asi tambien sale desde
        un servidor que el proveedor no alcanza (local). En simulado no se lee. */
    function photos(array $photos) {
        $config = $this->config();
        $upload = $config['provider'] === 'greenapi' && !$this->status()['missing'];
        $ready  = [];

        foreach ($photos as $photo) {
            $file  = (string) $photo['file'];
            $name  = (string) $photo['name'];
            $bytes = is_file($file) ? '' : false;

            if ($bytes !== false && $config['provider'] !== self::SIMULATED) {
                $bytes = @file_get_contents($file);

                // Foto de celular de varios MB: se reduce antes de subirla para que tarde menos.
                if ($bytes !== false) {
                    $small = $this->shrinkImage($bytes, $name);
                    $bytes = $small['bytes'];
                    $name  = $small['name'];
                }
            }

            $photo['name']   = $name;
            $photo['bytes']  = $bytes;
            $photo['remote'] = null;

            if ($bytes !== false && $upload) {
                try {
                    $photo['remote'] = $this->uploadGreenApi($config, $photo);
                } catch (Throwable $e) {
                    $this->writeToLog("[ WHATSAPP uploadFile ] :: " . $e->getMessage());
                    $photo['remote'] = ['ok' => false, 'detalle' => 'No se pudo subir la foto.'];
                }
            }

            $ready[] = $photo;
        }

        return $ready;
    }

    /*  El pie de foto admite 1024 caracteres en Green API y en UltraMsg; se deja
        margen porque los emojis pueden contar doble. Corta entre renglones y
        devuelve aparte lo que no cupo, para mandarlo enseguida como texto. */
    static function caption($text, $max = 1000) {
        $text = (string) $text;

        if (mb_strlen($text, 'UTF-8') <= $max) return [$text, ''];

        $lines   = explode("\n", $text);
        $caption = '';

        while ($lines && mb_strlen($caption . "\n" . $lines[0], 'UTF-8') <= $max) {
            $caption .= ($caption === '' ? '' : "\n") . array_shift($lines);
        }

        // Un solo renglon mas largo que el pie: se corta a la mitad del renglon.
        if ($caption === '') {
            return [mb_substr($text, 0, $max, 'UTF-8'), mb_substr($text, $max, null, 'UTF-8')];
        }

        return [rtrim($caption), ltrim(implode("\n", $lines))];
    }

    /*  Reduce la foto a 1600 px por lado y JPEG calidad 80 cuando pesa mas de
        300 KB o es mas grande que eso; en WhatsApp se ve igual y sube en una
        fraccion del tiempo. Sin GD, con GIF (puede ser animado), sin memoria o
        si no pesa menos, va la original tal cual. Igual que alpha. */
    private function shrinkImage($bytes, $name) {
        $original = ['bytes' => $bytes, 'name' => $name];
        $maxSide  = 1600;

        if (!function_exists('imagecreatefromstring') || strtolower(pathinfo($name, PATHINFO_EXTENSION)) === 'gif') return $original;

        $size = @getimagesizefromstring($bytes);
        if (!$size) return $original;

        list($width, $height) = $size;
        if (strlen($bytes) <= 300 * 1024 && max($width, $height) <= $maxSide) return $original;

        // GD descomprime la foto entera (4 bytes por pixel, mas margen): una de 12 MP pide ~70 MB.
        $scale = min(1, $maxSide / max($width, $height));
        $newW  = max(1, (int) round($width * $scale));
        $newH  = max(1, (int) round($height * $scale));

        if (!$this->memoryFor($width * $height * 6 + $newW * $newH * 10)) return $original;

        $source = @imagecreatefromstring($bytes);
        if (!$source) return $original;

        $target = imagecreatetruecolor($newW, $newH);

        // Fondo blanco: un PNG transparente pasado a JPEG quedaria con fondo negro.
        imagefill($target, 0, 0, imagecolorallocate($target, 255, 255, 255));
        imagecopyresampled($target, $source, 0, 0, 0, 0, $newW, $newH, $width, $height);
        imagedestroy($source);

        // Al volver a guardar se pierde la orientacion EXIF: se gira ya reducida.
        $turns = [3 => 180, 6 => -90, 8 => 90];
        $angle = $turns[$this->jpegOrientation($bytes)] ?? 0;

        if ($angle) {
            $rotated = imagerotate($target, $angle, 0);
            imagedestroy($target);
            $target = $rotated;
        }

        ob_start();
        imagejpeg($target, null, 80);
        $jpeg = ob_get_clean();
        imagedestroy($target);

        if ($jpeg === '' || strlen($jpeg) >= strlen($bytes)) return $original;

        return ['bytes' => $jpeg, 'name' => pathinfo($name, PATHINFO_FILENAME) . '.jpg'];
    }

    // Sube el memory_limit si hace falta; falso si ni asi alcanza (mejor la original que tumbar el aviso).
    private function memoryFor($needed) {
        $limit = trim((string) ini_get('memory_limit'));
        if ($limit === '-1') return true;

        $toBytes = function ($value) {
            $unit   = strtolower(substr($value, -1));
            $number = (float) $value;
            return (int) ($unit === 'g' ? $number * 1073741824 : ($unit === 'm' ? $number * 1048576 : ($unit === 'k' ? $number * 1024 : $number)));
        };

        $want = memory_get_usage() + $needed + 16 * 1048576;
        if ($toBytes($limit) >= $want) return true;

        return @ini_set('memory_limit', (string) min($want, 512 * 1048576)) !== false
            && $toBytes((string) ini_get('memory_limit')) >= $want;
    }

    // Orientacion EXIF de un JPEG (1 = derecha) leida a mano, sin la extension exif.
    private function jpegOrientation($bytes) {
        if (substr($bytes, 0, 2) !== "\xFF\xD8") return 1;

        $pos    = 2;
        $length = strlen($bytes);

        while ($pos + 4 <= $length && $bytes[$pos] === "\xFF") {
            $marker = ord($bytes[$pos + 1]);
            $size   = unpack('n', substr($bytes, $pos + 2, 2))[1];

            if ($marker === 0xE1 && substr($bytes, $pos + 4, 6) === "Exif\0\0") {
                $tiff   = $pos + 10;
                $little = substr($bytes, $tiff, 2) === 'II';
                $u16    = function ($at) use ($bytes, $little) { return unpack($little ? 'v' : 'n', substr($bytes, $at, 2))[1]; };
                $u32    = function ($at) use ($bytes, $little) { return unpack($little ? 'V' : 'N', substr($bytes, $at, 4))[1]; };

                $ifd   = $tiff + $u32($tiff + 4);
                $count = $u16($ifd);

                for ($i = 0; $i < $count; $i++) {
                    $entry = $ifd + 2 + $i * 12;
                    if ($entry + 10 > $length) break;
                    if ($u16($entry) === 0x0112) return $u16($entry + 8);
                }

                return 1;
            }

            // Inicio de la imagen comprimida: ya no hay mas encabezados.
            if ($marker === 0xDA) break;

            $pos += 2 + $size;
        }

        return 1;
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

    /*  Los grupos del WhatsApp conectado, para elegir uno como destinatario
        sin copiar su id: [[id …@g.us, name]] por nombre. No manda mensajes.
        Green API: getContacts (type «group»). UltraMsg: groups. En simulado
        no hay a quién preguntar: lista vacía con simulated = true. */
    function groups() {
        $config = $this->config();
        $status = $this->status();
        $answer = ['ok' => false, 'simulated' => false, 'groups' => [], 'detail' => ''];

        if ($config['provider'] === self::SIMULATED) return array_merge($answer, ['ok' => true, 'simulated' => true]);
        if ($status['missing']) return array_merge($answer, ['detail' => 'Faltan datos en el .env: ' . implode(', ', $status['missing']) . '.']);

        $url = $config['provider'] === 'greenapi'
            ? rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/getContacts/' . $config['token']
            : 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/groups?token=' . rawurlencode($config['token']);

        $res = $this->request($url);

        if ($res['error'] !== '') return array_merge($answer, ['detail' => 'No hubo respuesta del proveedor.']);
        if (!is_array($res['body']) || isset($res['body']['error']) || isset($res['body']['message'])) {
            return array_merge($answer, ['detail' => 'El proveedor no dio la lista de grupos (HTTP ' . $res['code'] . ').']);
        }

        $groups = [];

        foreach ($res['body'] as $item) {
            $id = is_array($item) ? trim((string) ($item['id'] ?? '')) : '';

            if (!preg_match('/^[0-9-]+@g\.us$/', $id)) continue;

            $name = trim((string) ($item['name'] ?? $item['subject'] ?? $item['contactName'] ?? ''));

            $groups[$id] = ['id' => $id, 'name' => $name !== '' ? $name : 'Grupo sin nombre'];
        }

        $groups = array_values($groups);

        usort($groups, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });

        return array_merge($answer, ['ok' => true, 'groups' => $groups]);
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

    /*  Green API: sendMessage (texto) y sendFileByUrl (la foto ya subida con
        uploadFile, $text va de pie) responden {idMessage} cuando el mensaje
        entra a la cola. */
    private function sendGreenApi($config, $to, $text, $photo = null) {
        $payload = $photo
            ? ['chatId' => $to, 'urlFile' => $photo['remote']['url'], 'fileName' => $photo['name'], 'caption' => (string) $text]
            : ['chatId' => $to, 'message' => $text];

        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance']
             . ($photo ? '/sendFileByUrl/' : '/sendMessage/') . $config['token'];
        $res = $this->request($url, json_encode($payload, JSON_UNESCAPED_UNICODE), 'application/json', $photo ? 60 : 20);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL.'];
        if (!empty($res['body']['idMessage'])) return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    /*  UltraMsg: messages/chat (texto) y messages/image (la foto en base64,
        $text va de pie) responden {sent: "true"} o {error: …}. Su tope es
        10,000,000 caracteres de base64 (unos 7 MB de foto). */
    private function sendUltraMsg($config, $to, $text, $photo = null) {
        $fields = ['body' => $text];

        if ($photo) {
            $encoded = base64_encode($photo['bytes']);
            if (strlen($encoded) > 10000000) return ['ok' => false, 'detalle' => 'La foto pesa más de 7 MB: UltraMsg no la acepta.'];

            $fields = ['image' => $encoded, 'caption' => (string) $text];
        }

        $url = 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/messages/' . ($photo ? 'image' : 'chat');
        $res = $this->request($url, http_build_query(array_merge([
            'token'    => $config['token'],
            'to'       => $to,
            'priority' => '10',
        ], $fields)), 'application/x-www-form-urlencoded', $photo ? 60 : 20);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];

        $sent = $res['body']['sent'] ?? '';
        if ($sent === true || $sent === 'true') return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['error'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
    }

    /*  Green API: uploadFile recibe la foto en crudo y devuelve {urlFile}, una
        URL publica de su almacenamiento (dura 15 dias). Va al host de la API:
        el de medios (media.green-api.com) no contesta. Como alpha. */
    private function uploadGreenApi($config, $photo) {
        $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
        $mime  = $mimes[strtolower(pathinfo($photo['name'], PATHINFO_EXTENSION))] ?? 'application/octet-stream';

        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/uploadFile/' . $config['token'];
        $res = $this->request($url, $photo['bytes'], $mime, 60, ['GA-Filename: ' . $photo['name']]);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL al subir la foto.'];
        if (!empty($res['body']['urlFile'])) return ['ok' => true, 'url' => $res['body']['urlFile'], 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('no se pudo subir la foto (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    /*  POST si trae $payload, GET si no. La URL lleva el token: nunca se
        escribe en el log. 20 s de espera para un texto (lo llaman el cierre de
        turno y el cobro, que esperan la respuesta); 60 s para una foto. */
    private function request($url, $payload = null, $contentType = 'application/json', $timeout = 20, $headers = []) {
        $curl = curl_init();

        $options = [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_SSL_VERIFYPEER => 0,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ];

        if ($payload !== null) {
            $options[CURLOPT_POST]       = true;
            $options[CURLOPT_POSTFIELDS] = $payload;
            $options[CURLOPT_HTTPHEADER] = array_merge(['Accept: application/json', 'Content-Type: ' . $contentType], $headers);
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
