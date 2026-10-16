<?php
// Portado de ERP-GV (DEV/conf/_Message.php). Wrapper sobre la API de UltraMsg.
require_once __DIR__ . '/_CRUD.php';

// Lo que aviso() lee y escribe de Admin > WhatsApp. Abre en utf8mb4: las plantillas
// llevan emojis y la conexion comun (utf8) los convierte en "?".
class MWaAviso extends CRUD {

    public function connect() {
        parent::connect();
        if ($this->connected) $this->mysql->exec('SET NAMES utf8mb4');
    }

    function getWaPlantillaByType($array) {
        $query = "
            SELECT body, active
            FROM wa_plantillas
            WHERE companies_id = ? AND type = ?";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    // Solo un proveedor queda activo por empresa (saveWaProvider apaga los demas).
    function getWaConfigActive($array) {
        $query = "
            SELECT provider, instance, token, api_url
            FROM wa_config
            WHERE companies_id = ? AND active = 1
            LIMIT 1";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    function listWaDestinatarios($array) {
        $query = "
            SELECT phone
            FROM wa_destinatarios
            WHERE companies_id = ? AND type = ? AND active = 1";

        return $this->_Read($query, $array) ?: [];
    }

    function existsWaHistorialByReference($array) {
        $query = "
            SELECT id
            FROM wa_historial
            WHERE companies_id = ? AND type = ? AND reference = ?
            LIMIT 1";

        return !empty($this->_Read($query, $array));
    }

    // El ultimo envio con esa referencia; primero el que guardo su snapshot.
    function getWaHistorialLast($array) {
        $query = "
            SELECT id, type, snapshot
            FROM wa_historial
            WHERE companies_id = ? AND reference = ?
            ORDER BY (snapshot IS NULL), id DESC
            LIMIT 1";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    function createWaHistorial($array) {
        return $this->_Insert([
            'table'  => 'wa_historial',
            'values' => ['type', 'reference', 'recipients', 'provider', 'error', 'snapshot', 'status', 'subsidiaries_id', 'companies_id'],
            'data'   => $array
        ]);
    }
}

class Message {

    const TOKEN    = 'pjsvyuxnqx2rj4edrak';
    const INSTANCE = 'instance50238';

    // ENVIAR CORREO ELECTRONICO
    public function correo($destinatario, $asunto, $mensaje) {
        $headers = 'From: soporte@erp-varoch.com' . "\r\n" .
                   'Reply-To: soporte@erp-varoch.com' . "\r\n" .
                   'X-Mailer: PHP/' . phpversion();

        return mail($destinatario, $asunto, $mensaje, $headers) ? true : false;
    }

    // ENVIAR MENSAJE WHATSAPP
    // $telefono: string de 10 digitos (se le antepone +52), numero completo,
    // id de grupo ('...@g.us'), o array de cualquiera de los anteriores.
    public function whatsapp($telefono, $mensaje) {
        $params = [
            'token'       => self::TOKEN,
            'to'          => $this->destinatario($telefono),
            'body'        => $mensaje,
            'priority'    => '10',
            'referenceId' => '',
            'msgId'       => '',
            'mentions'    => ''
        ];

        return $this->send('chat', $params);
    }

    // ENVIAR MENSAJE Y ARCHIVO WHATSAPP
    // $ruta debe ser una URL publica: UltraMsg descarga el archivo desde ahi.
    public function whatsapp_file($telefono, $mensaje, $ruta, $file) {
        $params = [
            'token'       => self::TOKEN,
            'to'          => $this->destinatario($telefono),
            'filename'    => $file,
            'document'    => $ruta . '/' . $file,
            'caption'     => $mensaje,
            'priority'    => '',
            'referenceId' => '',
            'nocache'     => '',
            'msgId'       => '',
            'mentions'    => ''
        ];

        return $this->send('document', $params);
    }

    // AVISO CONFIGURADO EN ADMIN > WHATSAPP
    // Usa el proveedor activo de la empresa, la plantilla del aviso ($type) y sus
    // destinatarios encendidos; {variable} se reemplaza con $vars. Cada envio queda en
    // wa_historial. Nunca lanza: el aviso no debe tumbar la operacion que lo dispara.
    // Con $once = true no envia si ya hay un registro con esa referencia. $snapshot se
    // guarda con el envio para que el siguiente aviso sepa que cambio (ver lastAviso).
    // $images: [file (ruta en disco), name, caption, reference] por foto. La primera va
    // arriba del mensaje (el texto es su pie); las demas, detras, una por mensaje y con
    // su propia fila en el historial.
    public function aviso($type, $companyId, $vars, $reference = null, $subsidiaryId = null, $once = false, $snapshot = null, $images = []) {
        $result = ['enviados' => 0, 'fallidos' => 0];

        try {
            $data     = new MWaAviso();
            if ($once && $data->existsWaHistorialByReference([$companyId, $type, $reference])) return $result;

            $snapshot = $snapshot === null ? null : json_encode($snapshot, JSON_UNESCAPED_UNICODE);

            $template = $data->getWaPlantillaByType([$companyId, $type]);
            $config   = $data->getWaConfigActive([$companyId]);
            $phones   = $data->listWaDestinatarios([$companyId, $type]);

            // Aviso pausado, sin proveedor o sin destinatarios: no se manda nada.
            if (!$template || intval($template['active']) !== 1 || !$config || empty($phones)) return $result;

            $text = $this->fillTemplate($template['body'], $vars);

            // La foto viaja como archivo, no como URL nuestra: asi tambien sale desde un
            // servidor que el proveedor no alcanza (local). Se lee una sola vez; Green API
            // ademas la sube una vez a su almacenamiento y la reparte por URL a cada numero.
            foreach ($images as $index => $image) {
                $bytes = is_file($image['file']) ? file_get_contents($image['file']) : false;

                // Foto de celular de varios MB: se reduce antes de subirla para que tarde menos.
                if ($bytes !== false) {
                    $small = $this->shrinkImage($bytes, $image['name']);
                    $bytes = $small['bytes'];
                    $images[$index]['name'] = $small['name'];
                }

                $images[$index]['bytes'] = $bytes;
            }

            foreach ($images as $index => $image) {
                $images[$index]['remote'] = ($image['bytes'] !== false && $config['provider'] === 'greenapi')
                    ? $this->uploadGreenApi($config, $image)
                    : null;
            }

            $log = function ($ref, $to, $res, $snap = null) use ($data, $type, $config, $subsidiaryId, $companyId) {
                $data->createWaHistorial([
                    $type,
                    $ref,
                    $to,
                    $config['provider'],
                    $res['ok'] ? null : mb_substr($res['detalle'], 0, 255),
                    $snap,
                    $res['ok'] ? 'enviado' : 'fallido',
                    $subsidiaryId,
                    $companyId
                ]);
            };

            foreach ($phones as $row) {
                $to   = $this->providerRecipient($config['provider'], $row['phone']);
                $sent = null;
                $rest = '';

                // Con fotos, la primera va arriba del mensaje y el texto viaja como su pie.
                // Si la foto falla, el aviso sale igual como texto solo.
                if ($images) {
                    list($caption, $rest) = $this->splitCaption($text);
                    $sent = $this->deliver($config, $to, $caption, $images[0]);

                    if (!$sent['ok']) {
                        $log($images[0]['reference'], $to, $sent);
                        $sent = null;
                        $rest = '';
                    }
                }

                if (!$sent) $sent = $this->deliver($config, $to, $text);

                $log($reference, $to, $sent, $snapshot);
                $result[$sent['ok'] ? 'enviados' : 'fallidos']++;

                // Si el aviso no salio, las fotos llegarian sueltas y sin contexto.
                if (!$sent['ok']) continue;

                // Lo que no cupo en el pie de la foto.
                if ($rest !== '') {
                    $more = $this->deliver($config, $to, $rest);
                    if (!$more['ok']) $log("{$reference} · continuación", $to, $more);
                }

                foreach (array_slice($images, 1) as $image) {
                    $log($image['reference'], $to, $this->deliver($config, $to, $image['caption'], $image));
                }
            }
        } catch (Throwable $e) {
            $this->writeToLog("[ WHATSAPP aviso {$type} ] :: " . $e->getMessage());
        }

        return $result;
    }

    // Ultimo aviso que salio con esa referencia, o null si nunca salio. snapshot es lo
    // que se guardo con el (null en los avisos de antes de guardarlo).
    public function lastAviso($companyId, $reference) {
        try {
            $row = (new MWaAviso())->getWaHistorialLast([$companyId, $reference]);
        } catch (Throwable $e) {
            $this->writeToLog("[ WHATSAPP lastAviso ] :: " . $e->getMessage());
            return null;
        }

        if (!$row) return null;

        return [
            'type'     => $row['type'],
            'snapshot' => $row['snapshot'] ? json_decode($row['snapshot'], true) : null
        ];
    }

    // Reemplaza {variable} con $vars. El renglón cuyas variables llegan todas vacías (o que
    // el aviso no manda) no sale; si eso deja un título *SECCIÓN* sin renglones debajo,
    // tampoco sale.
    private function fillTemplate($body, $vars) {
        $hasValue = function ($key) use ($vars) {
            return isset($vars[$key]) && trim((string) $vars[$key]) !== '';
        };

        $lines = [];

        // Saltos explícitos: \R sin /u toma el byte 0x85 de algunos emojis (📅) como salto.
        foreach (preg_split('/\r\n|\r|\n/', (string) $body) as $line) {
            $keys = preg_match_all('/\{(\w+)\}/', $line, $found) ? $found[1] : [];
            if ($keys && !array_filter($keys, $hasValue)) continue;

            // Un conteo en cero entre parentesis no se muestra: "Efectivo ({efectivo_n}):"
            // queda "Efectivo:" en lugar de "Efectivo (-):".
            $line = preg_replace_callback('/ ?\(\{(\w+)\}\)/', function ($match) use ($vars, $hasValue) {
                return (!$hasValue($match[1]) || (string) $vars[$match[1]] === '-') ? '' : $match[0];
            }, $line);

            // Un monto en cero llega como "-": el "$" de la plantilla (${efectivo}) se quita
            // para que no salga "$-".
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

    // Mismo formato que Admin > WhatsApp: UltraMsg +52…, Green API 521…@c.us.
    // Los grupos (…@g.us) pasan igual en los dos.
    private function providerRecipient($provider, $phone) {
        if (substr($phone, -5) === '@g.us') return $phone;

        return $provider === 'greenapi' ? '521' . $phone . '@c.us' : '+52' . $phone;
    }

    // Reduce la foto a 1600 px por lado y JPEG calidad 80 cuando pesa mas de 300 KB o es
    // mas grande que eso; en WhatsApp se ve igual y sube en una fraccion del tiempo. Si
    // no hay GD, si es GIF (puede ser animado), si no alcanza la memoria o si el
    // resultado no pesa menos, se manda la original tal cual.
    private function shrinkImage($bytes, $name) {
        $original = ['bytes' => $bytes, 'name' => $name];
        $maxSide  = 1600;

        if (!function_exists('imagecreatefromstring') || strtolower(pathinfo($name, PATHINFO_EXTENSION)) === 'gif') return $original;

        $size = @getimagesizefromstring($bytes);
        if (!$size) return $original;

        list($width, $height) = $size;
        if (strlen($bytes) <= 300 * 1024 && max($width, $height) <= $maxSide) return $original;

        // GD descomprime la foto entera (4 bytes por pixel, mas margen): una de 12 MP
        // pide ~70 MB. La copia chica se suma aparte.
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

        // Al volver a guardar se pierde la orientacion EXIF: la foto del celular quedaria
        // acostada. Se gira ya reducida (girar la original duplicaria la memoria).
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

    // Sube el memory_limit si hace falta para $needed bytes mas lo ya usado; falso si
    // ni asi alcanza (mejor mandar la original que tumbar el aviso por memoria).
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

    // Orientacion EXIF de un JPEG (1 = derecha) leida a mano, sin depender de la
    // extension exif. Recorre los marcadores hasta el APP1 "Exif" y busca la etiqueta
    // 0x0112 en el IFD0.
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

    // Un mensaje por el proveedor activo: texto, o foto con $text de pie.
    private function deliver($config, $to, $text, $image = null) {
        if ($image && $image['bytes'] === false) return ['ok' => false, 'detalle' => 'La foto ya no está en el servidor.'];
        if ($image && $image['remote'] && !$image['remote']['ok']) return $image['remote'];

        return $config['provider'] === 'greenapi'
            ? $this->sendGreenApi($config, $to, $text, $image)
            : $this->sendUltraMsg($config, $to, $text, $image);
    }

    // El pie de foto admite 1024 caracteres en Green API y en UltraMsg; se deja margen
    // porque los emojis pueden contar doble. Corta entre renglones y devuelve aparte lo
    // que no cupo, para mandarlo enseguida como texto.
    private function splitCaption($text, $max = 1000) {
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

    // Green API: sendMessage (texto) y sendFileByUrl (imagen ya subida con uploadFile,
    // $text va de pie) responden {idMessage} cuando el mensaje entra a la cola.
    private function sendGreenApi($config, $to, $text, $image = null) {
        $payload = $image
            ? ['chatId' => $to, 'urlFile' => $image['remote']['url'], 'fileName' => $image['name'], 'caption' => $text]
            : ['chatId' => $to, 'message' => $text];

        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance']
             . ($image ? '/sendFileByUrl/' : '/sendMessage/') . $config['token'];
        $res = $this->post($url, json_encode($payload), 'application/json');

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL.'];
        if (!empty($res['body']['idMessage'])) return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    // UltraMsg: messages/chat (texto) y messages/image (imagen en base64, $text va de
    // pie) responden {sent: "true"} o {error: …}. Su tope es 10,000,000 caracteres de
    // base64 (unos 7 MB de foto).
    private function sendUltraMsg($config, $to, $text, $image = null) {
        $fields = ['body' => $text];

        if ($image) {
            $encoded = base64_encode($image['bytes']);
            if (strlen($encoded) > 10000000) return ['ok' => false, 'detalle' => 'La foto pesa más de 7 MB: UltraMsg no la acepta.'];

            $fields = ['image' => $encoded, 'caption' => $text];
        }

        $url = 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/messages/' . ($image ? 'image' : 'chat');
        $res = $this->post($url, http_build_query(array_merge([
            'token'    => $config['token'],
            'to'       => $to,
            'priority' => '10'
        ], $fields)), 'application/x-www-form-urlencoded');

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];

        $sent = $res['body']['sent'] ?? '';
        if ($sent === true || $sent === 'true') return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['error'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
    }

    // Green API: uploadFile recibe la foto en crudo y devuelve {urlFile}, una URL publica
    // de su almacenamiento (dura 15 dias). Va al host de la API: el de medios
    // (media.green-api.com) no contesta desde aqui. Probado con la instancia 7107.
    private function uploadGreenApi($config, $image) {
        $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
        $mime  = $mimes[strtolower(pathinfo($image['name'], PATHINFO_EXTENSION))] ?? 'application/octet-stream';

        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/uploadFile/' . $config['token'];
        $res = $this->post($url, $image['bytes'], $mime, ['GA-Filename: ' . $image['name']]);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL al subir la foto.'];
        if (!empty($res['body']['urlFile'])) return ['ok' => true, 'url' => $res['body']['urlFile'], 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('no se pudo subir la foto (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    // La URL lleva el token: nunca se escribe en el log. Las fotos suben completas,
    // por eso el tiempo de espera es mas largo que el de un texto.
    private function post($url, $payload, $contentType, $headers = []) {
        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_SSL_VERIFYPEER => 0,
            CURLOPT_HTTPHEADER     => array_merge([
                'Accept: application/json',
                'Content-Type: ' . $contentType
            ], $headers),
        ]);

        $raw   = curl_exec($curl);
        $error = curl_error($curl);
        $code  = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
        curl_close($curl);

        return [
            'code'  => $code,
            'error' => $error,
            'body'  => $raw ? json_decode($raw, true) : null
        ];
    }

    // Normaliza el destinatario: los numeros de 10 digitos llevan lada +52,
    // los arrays se unen con comas (UltraMsg acepta varios destinos asi).
    private function destinatario($telefono) {
        if (is_array($telefono)) {
            $lista = [];
            foreach ($telefono as $tel) {
                $lista[] = (strlen($tel) == 10) ? '+52' . $tel : $tel;
            }
            return implode(',', $lista);
        }

        return (strlen($telefono) == 10) ? '+52' . $telefono : $telefono;
    }

    private function send($endpoint, $params) {
        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL            => 'https://api.ultramsg.com/' . self::INSTANCE . '/messages/' . $endpoint,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING       => '',
            CURLOPT_MAXREDIRS      => 10,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_SSL_VERIFYPEER => 0,
            CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST  => 'POST',
            CURLOPT_POSTFIELDS     => http_build_query($params),
            CURLOPT_HTTPHEADER     => ['content-type: application/x-www-form-urlencoded'],
        ]);

        curl_exec($curl);
        $err = curl_error($curl);
        curl_close($curl);

        if ($err) {
            $this->writeToLog("[ https://api.ultramsg.com ] :: WHATSAPP\n[ ERROR cURL ] :: " . $err);
            return 'cURL Error #:' . $err;
        }

        return true;
    }

    private function writeToLog($message) {
        error_log('[ ' . date('Y-m-d H:i:s') . " ]\n" . $message . PHP_EOL, 3, 'error.log');
    }

    // Tratamiento de nombre
    public function tratamiento_nombre($name, $last_name) {
        $nombre = ucwords(mb_strtolower($name, 'utf-8'));
        if (str_word_count($nombre) === 1 || str_word_count($nombre) > 2)
            $nombre = explode(' ', $nombre)[0] . ' ' . ucfirst(explode(' ', mb_strtolower($last_name, 'utf-8'))[0]);

        return $nombre;
    }
}
?>
