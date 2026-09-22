<?php
/*  Envío de correo del módulo de acceso.

    Portado de alpha/conf/_Message.php, recortado a lo único que usa
    inventory: el correo. El WhatsApp de aquel se quedó fuera porque
    `users` no guarda teléfono.  */
class Message {

    const REMITENTE = 'soporte@erp-varoch.com';

    /*  LA @ NO ES PEREZA, ES LO QUE MANTIENE VIVA LA RESPUESTA.

        Sin servidor SMTP a mano --el caso en local, donde nadie escucha en
        localhost:25-- mail() imprime un Warning ADEMÁS de devolver false. A este
        helper lo llama un controlador que está contestando JSON, así que ese
        Warning saldría antes del JSON y lo volvería imposible de parsear: el
        navegador diría "no se pudo conectar con el servidor" en vez de
        "no pudimos entregarte el código".

        El fallo no se pierde por silenciarlo: se devuelve false --que es lo que
        mira quien llama-- y queda anotado en el log.  */
    public function correo($destinatario, $asunto, $mensaje) {
        $headers = 'From: ' . self::REMITENTE . "\r\n" .
                   'Reply-To: ' . self::REMITENTE . "\r\n" .
                   'Content-Type: text/plain; charset=UTF-8' . "\r\n" .
                   'X-Mailer: PHP/' . phpversion();

        if (@mail($destinatario, $asunto, $mensaje, $headers)) return true;

        $this->writeToLog("[ mail() ] :: CORREO\n[ ERROR ] :: no se pudo entregar a {$destinatario}\n");

        return false;
    }

    public function writeToLog($message) {
        $linea = "[ " . date('Y-m-d H:i:s') . " ]\n" . $message . PHP_EOL;

        file_put_contents(__DIR__ . '/mail.log', $linea, FILE_APPEND | LOCK_EX);
    }
}
