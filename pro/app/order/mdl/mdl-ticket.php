<?php
/*  V7 · Ticket por enlace. El cliente abre su ticket sin iniciar sesion.

    El enlace lleva el id de la venta y una firma: k = HMAC-SHA256('ticket:<id>'),
    recortada a 20 caracteres hex (80 bits). Sin la llave del servidor no se
    puede adivinar la firma de otra venta: cambiar el numero en la direccion
    no abre el ticket de nadie. No guarda nada en la base.

    La llave:
      TICKET_KEY en core/config/.env, si existe.
      Si no, se deriva de las DB_* del mismo .env: funciona sin tocar el .env,
      pero si cambia la contraseña de la base los enlaces viejos dejan de abrir.

    Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
    del ctrl que llegue en 'opc', y los de un trait cuentan. */
trait TicketLink {

    // -- Firma --

    protected function ticketKey() {
        static $key = null;

        if ($key !== null) return $key;

        $file = __DIR__ . '/../../../core/config/.env';
        $env  = is_readable($file) ? @parse_ini_file($file) : false;
        $env  = is_array($env) ? $env : [];
        $own  = trim((string) ($env['TICKET_KEY'] ?? ''));

        $key = $own !== ''
            ? $own
            : hash('sha256', 'huubie-ticket|' . ($env['DB_USER'] ?? '') . '|' . ($env['DB_PASS'] ?? '') . '|' . ($env['DB_NAME'] ?? ''));

        return $key;
    }

    protected function ticketSign($saleId) {
        return substr(hash_hmac('sha256', 'ticket:' . (int) $saleId, $this->ticketKey()), 0, 20);
    }

    protected function ticketValid($saleId, $sign) {
        if ((int) $saleId <= 0 || !is_string($sign) || strlen($sign) !== 20) return false;

        return hash_equals($this->ticketSign($saleId), strtolower($sign));
    }

    /*  La direccion completa. El ctrl corre en …/app/order/ctrl/ctrl-x.php;
        la pagina publica vive en …/app/order/ticket.php. */
    protected function ticketUrl($saleId) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
              || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host  = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $base  = rtrim(str_replace('\\', '/', dirname(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')))), '/');

        return ($https ? 'https' : 'http') . '://' . $host . $base
             . '/ticket.php?v=' . (int) $saleId . '&k=' . $this->ticketSign($saleId);
    }

    // Lo que necesita el boton «Enviar ticket»: el enlace y el telefono del cliente (10 digitos o '').
    protected function ticketShare($saleId, $phone) {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return [
            'link'  => $this->ticketUrl($saleId),
            'phone' => strlen($digits) === 10 ? $digits : ''
        ];
    }
}
