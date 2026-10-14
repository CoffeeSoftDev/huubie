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

    function createWaHistorial($array) {
        return $this->_Insert([
            'table'  => 'wa_historial',
            'values' => ['type', 'reference', 'recipients', 'provider', 'error', 'status', 'subsidiaries_id', 'companies_id'],
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
    // Con $once = true no envia si ya hay un registro con esa referencia.
    public function aviso($type, $companyId, $vars, $reference = null, $subsidiaryId = null, $once = false) {
        $result = ['enviados' => 0, 'fallidos' => 0];

        try {
            $data     = new MWaAviso();
            if ($once && $data->existsWaHistorialByReference([$companyId, $type, $reference])) return $result;

            $template = $data->getWaPlantillaByType([$companyId, $type]);
            $config   = $data->getWaConfigActive([$companyId]);
            $phones   = $data->listWaDestinatarios([$companyId, $type]);

            // Aviso pausado, sin proveedor o sin destinatarios: no se manda nada.
            if (!$template || intval($template['active']) !== 1 || !$config || empty($phones)) return $result;

            $text = preg_replace_callback('/\{(\w+)\}/', function ($match) use ($vars) {
                return array_key_exists($match[1], $vars) ? $vars[$match[1]] : $match[0];
            }, $template['body']);

            foreach ($phones as $row) {
                $to   = $this->providerRecipient($config['provider'], $row['phone']);
                $sent = $config['provider'] === 'greenapi'
                    ? $this->sendGreenApi($config, $to, $text)
                    : $this->sendUltraMsg($config, $to, $text);

                $data->createWaHistorial([
                    $type,
                    $reference,
                    $to,
                    $config['provider'],
                    $sent['ok'] ? null : mb_substr($sent['detalle'], 0, 255),
                    $sent['ok'] ? 'enviado' : 'fallido',
                    $subsidiaryId,
                    $companyId
                ]);

                $result[$sent['ok'] ? 'enviados' : 'fallidos']++;
            }
        } catch (Throwable $e) {
            $this->writeToLog("[ WHATSAPP aviso {$type} ] :: " . $e->getMessage());
        }

        return $result;
    }

    // Mismo formato que Admin > WhatsApp: UltraMsg +52…, Green API 521…@c.us.
    // Los grupos (…@g.us) pasan igual en los dos.
    private function providerRecipient($provider, $phone) {
        if (substr($phone, -5) === '@g.us') return $phone;

        return $provider === 'greenapi' ? '521' . $phone . '@c.us' : '+52' . $phone;
    }

    // Green API: sendMessage responde {idMessage} cuando el mensaje entra a la cola.
    private function sendGreenApi($config, $to, $text) {
        $url = rtrim($config['api_url'], '/') . '/waInstance' . $config['instance'] . '/sendMessage/' . $config['token'];
        $res = $this->post($url, json_encode(['chatId' => $to, 'message' => $text]), true);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL.'];
        if (!empty($res['body']['idMessage'])) return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    // UltraMsg: messages/chat responde {sent: "true"} o {error: …}.
    private function sendUltraMsg($config, $to, $text) {
        $url = 'https://api.ultramsg.com/' . rawurlencode($config['instance']) . '/messages/chat';
        $res = $this->post($url, http_build_query([
            'token'    => $config['token'],
            'to'       => $to,
            'body'     => $text,
            'priority' => '10'
        ]), false);

        if ($res['error'] !== '') return ['ok' => false, 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];

        $sent = $res['body']['sent'] ?? '';
        if ($sent === true || $sent === 'true') return ['ok' => true, 'detalle' => ''];

        $detail = $res['body']['error'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
    }

    // La URL lleva el token: nunca se escribe en el log.
    private function post($url, $payload, $asJson) {
        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_SSL_VERIFYPEER => 0,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                $asJson ? 'Content-Type: application/json' : 'Content-Type: application/x-www-form-urlencoded'
            ],
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
