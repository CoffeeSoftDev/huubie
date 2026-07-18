<?php
// Portado de ERP-GV (DEV/conf/_Message.php). Wrapper sobre la API de UltraMsg.
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
