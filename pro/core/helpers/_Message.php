<?php
/*  MENSAJES SALIENTES. Portado de erp-pro/pro/core/Helpers/_Message.php.

    Solo el correo. De alla se quedaron fuera:
      - whatsapp() y whatsapp_file(): llevan escrito el token de la instancia de
        ultramsg de Grupo Varoch, y users no guarda telefono.
      - correoDesde(): manda desde el buzon del colaborador y depende de
        _Buzon.php (IMAP de coffeeIA), que pro/ no tiene. */
class Message {
    /*  ENVIAR CORREO ELECTRONICO

        Dos caminos, y el .env decide:
          - Con MAIL_HOST: por SMTP autenticado contra ese servidor. Es el que
            funciona en local (en WAMP nadie escucha en localhost:25) y el que
            llega sin ir a spam, porque sale del servidor del dominio del
            remitente.
          - Sin MAIL_HOST: mail() de PHP.

        En los dos el texto va declarado como UTF-8 y el asunto codificado: un
        asunto con acentos sin codificar es cabecera invalida.

        Devuelve true o false, nunca imprime nada (ver la nota de la @). */
    public function correo($destinatario, $asunto, $mensaje) {
        $env  = $this->mailEnv();
        $from = $env['MAIL_FROM'] ?? 'no-reply@huubie.com.mx';
        $name = $env['MAIL_FROM_NAME'] ?? 'Huubie';

        list($asuntoMime, $headers, $cuerpo) = $this->armar($from, $name, $asunto, $mensaje);

        if (!empty($env['MAIL_HOST'])) {
            $error = $this->smtp($env, $from, $destinatario, $asuntoMime, $headers, $cuerpo);
            if ($error === null) return true;

            $this->writeToLog("[ SMTP {$env['MAIL_HOST']} ] ::  CORREO\n[ ERROR ] :: no se pudo entregar a {$destinatario}: {$error}\n");
            return false;
        }

        /*  LA @ ES LO QUE MANTIENE VIVA LA RESPUESTA. Sin servidor de correo
            -- el caso en local -- mail() imprime un Warning ademas de devolver
            false, y a este helper lo llaman controladores que contestan JSON:
            el Warning salia antes del JSON y el navegador decia "no se pudo
            conectar". El fallo no se pierde: se devuelve false y queda en el log. */
        if (@mail($destinatario, $asuntoMime, $cuerpo, implode("\r\n", $headers))) return true;

        $this->writeToLog("[ mail() ] ::  CORREO\n[ ERROR ] :: no se pudo entregar a {$destinatario}"
            . " (sin MAIL_HOST en pro/core/config/.env: en local no hay servidor de correo)\n");

        return false;
    }

    /*  Asunto, cabeceras y cuerpo.

        base64 y no 8bit en el cuerpo: ningun servidor intermedio lo reescribe,
        y no hay lineas que empiecen con "." que SMTP confundiria con el fin
        del mensaje. (Alla tambien armaba adjuntos para correoDesde(); sin ella
        no los pide nadie.) */
    private function armar($from, $name, $asunto, $mensaje) {
        $asuntoMime = '=?UTF-8?B?' . base64_encode($asunto) . '?=';

        // Lineas con \n: smtp() las pasa a \r\n. Con el \r\n de chunk_split salia \r\r\n.
        $cuerpo = chunk_split(base64_encode(str_replace(["\r\n", "\r"], "\n", $mensaje)), 76, "\n");

        $headers = [
            'From: =?UTF-8?B?' . base64_encode($name) . "?= <{$from}>",
            "Reply-To: {$from}",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            'X-Mailer: PHP/' . phpversion(),
        ];

        return [$asuntoMime, $headers, $cuerpo];
    }

    // Las MAIL_* de pro/core/config/.env. Sin archivo o sin claves, [] y va por mail().
    private function mailEnv() {
        $ruta = __DIR__ . '/../config/.env';
        $env  = is_file($ruta) ? @parse_ini_file($ruta) : false;
        if (!is_array($env)) return [];

        return array_filter($env, function ($valor, $llave) {
            return strpos($llave, 'MAIL_') === 0 && trim((string) $valor) !== '';
        }, ARRAY_FILTER_USE_BOTH);
    }

    /*  Cliente SMTP minimo: sin PHPMailer porque pro/ no tiene Composer y para
        un texto plano no hace falta mas.

        MAIL_PORT 465 = TLS desde el primer byte; 587 (o cualquier otro) =
        conexion en claro que sube a TLS con STARTTLS antes de mandar la clave.
        Nunca se autentica sin cifrar.

        Devuelve null si el servidor acepto el mensaje, o el texto del error. */
    private function smtp($env, $from, $destinatario, $asunto, $headers, $cuerpo) {
        $host = $env['MAIL_HOST'];
        $port = intval($env['MAIL_PORT'] ?? 587);

        $ssl = ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host];
        if (!empty($env['MAIL_CA_BUNDLE'])) $ssl['cafile'] = $env['MAIL_CA_BUNDLE'];
        $ctx = stream_context_create(['ssl' => $ssl]);

        $scheme = $port === 465 ? 'ssl://' : 'tcp://';
        $sock = @stream_socket_client($scheme . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$sock) return "no conecta con {$host}:{$port} ({$errstr})";
        stream_set_timeout($sock, 20);

        // Una respuesta SMTP puede ocupar varias lineas: "250-..." sigue, "250 ..." termina.
        $leer = function () use ($sock) {
            $todo = '';
            while (($linea = fgets($sock, 1024)) !== false) {
                $todo .= $linea;
                if (strlen($linea) < 4 || $linea[3] !== '-') break;
            }
            return $todo;
        };
        $paso = function ($comando, $espera) use ($sock, $leer) {
            if ($comando !== null) fwrite($sock, $comando . "\r\n");
            $resp = $leer();
            if (strpos($resp, (string) $espera) === 0) return null;
            return trim($resp) !== '' ? trim($resp) : 'el servidor no contesto';
        };

        $yo       = gethostname() ?: 'localhost';
        $destinos = array_filter(array_map('trim', explode(',', $destinatario)));

        $error = $paso(null, 220)
              ?? $paso("EHLO {$yo}", 250);

        if ($error === null && $port !== 465) {
            $error = $paso('STARTTLS', 220);
            if ($error === null && !@stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                $error = 'no se pudo cifrar la conexion (STARTTLS). Si es el certificado, pon MAIL_CA_BUNDLE en el .env';
            }
            // Tras STARTTLS el servidor olvida el saludo: se repite
            if ($error === null) $error = $paso("EHLO {$yo}", 250);
        }

        if ($error === null && !empty($env['MAIL_USER'])) {
            $error = $paso('AUTH LOGIN', 334)
                  ?? $paso(base64_encode($env['MAIL_USER']), 334)
                  ?? $paso(base64_encode($env['MAIL_PASS'] ?? ''), 235);
        }

        if ($error === null) $error = $paso("MAIL FROM:<{$from}>", 250);
        foreach ($destinos as $destino) {
            if ($error === null) $error = $paso("RCPT TO:<{$destino}>", 250);
        }

        if ($error === null) $error = $paso('DATA', 354);
        if ($error === null) {
            fwrite($sock, $this->crudo($from, $destinos, $asunto, $headers, $cuerpo) . ".\r\n");
            $error = $paso(null, 250);
        }

        @fwrite($sock, "QUIT\r\n");
        fclose($sock);

        return $error;
    }

    // El mensaje entero, como viaja: cabeceras, linea en blanco y cuerpo, todo con \r\n.
    private function crudo($from, $destinos, $asunto, $headers, $cuerpo) {
        $mime = array_merge([
            'Date: ' . date('r'),
            'To: ' . implode(', ', $destinos),
            "Subject: {$asunto}",
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . substr(strrchr($from, '@'), 1) . '>',
        ], $headers);

        return implode("\r\n", $mime) . "\r\n\r\n" . str_replace("\n", "\r\n", rtrim($cuerpo)) . "\r\n";
    }

    /*  Se anexa con un solo append bloqueado, aparte del log de _Conect.php: aquel
        lee el archivo entero para anteponer cada mensaje. mail.log no se sirve
        por web (pro/.htaccess). */
    public function writeToLog($message) {
        require_once(__DIR__ . '/_Zona.php');

        $linea = "[ " . date('Y-m-d H:i:s') . " ]\n" . $message . PHP_EOL;

        file_put_contents(__DIR__ . '/mail.log', $linea, FILE_APPEND | LOCK_EX);
    }
}
?>
