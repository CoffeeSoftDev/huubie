<?php
/*  STRIPE, SIN SDK: las cuatro llamadas que hacen falta, con curl.

    Las llaves van en core/config/.env (nunca en el codigo ni en el navegador):

      STRIPE_SECRET_KEY       sk_test_... / sk_live_...   obligatoria
      STRIPE_WEBHOOK_SECRET   whsec_...   la del endpoint api/ctrl/ctrl-stripe.php
      STRIPE_CA_BUNDLE        opcional: ruta a un cacert.pem si PHP no trae
                              certificados raiz (WAMP). La verificacion TLS no
                              se apaga nunca; sin certificados, la llamada falla.

    La llave publicable (pk_...) no se usa: el pago ocurre en la pagina de
    Stripe (Checkout), no en un formulario nuestro. */
class Stripe {
    const API = 'https://api.stripe.com/v1/';

    // Cuanto se tolera entre la firma del webhook y ahora (segundos).
    const TOLERANCE = 300;

    private static $env = null;

    static function env($key) {
        if (self::$env === null) {
            $file = __DIR__ . '/../config/.env';
            $ini  = is_readable($file) ? parse_ini_file($file) : false;
            self::$env = is_array($ini) ? $ini : [];
        }

        return trim((string) (self::$env[$key] ?? ''));
    }

    // ¿Hay con que cobrar? Sin llave, las pantallas esconden el boton de pago.
    static function ready() {
        return self::env('STRIPE_SECRET_KEY') !== '';
    }

    /*  Una llamada a la API. Devuelve [datos, error]: uno de los dos es null.
        Los parametros van como formulario; los anidados, con corchetes
        (http_build_query ya los arma asi). */
    static function request($method, $path, $params = []) {
        if (!self::ready()) return [null, 'Falta STRIPE_SECRET_KEY en core/config/.env'];

        $url = self::API . ltrim($path, '/');
        if ($method === 'GET' && $params) $url .= '?' . http_build_query($params);

        $curl = curl_init($url);

        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_USERPWD        => self::env('STRIPE_SECRET_KEY') . ':',
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        if ($method !== 'GET') curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($params));

        $ca = self::env('STRIPE_CA_BUNDLE');
        if ($ca !== '' && is_readable($ca)) curl_setopt($curl, CURLOPT_CAINFO, $ca);

        $body  = curl_exec($curl);
        $error = curl_error($curl);
        curl_close($curl);

        if ($body === false) return [null, 'Sin conexión con Stripe: ' . $error];

        $data = json_decode($body, true);

        if (!is_array($data))        return [null, 'Stripe contestó algo que no se pudo leer.'];
        if (isset($data['error']))   return [null, (string) ($data['error']['message'] ?? 'Stripe rechazó la solicitud.')];

        return [$data, null];
    }

    /*  ¿Este webhook lo mando Stripe? La firma es un HMAC-SHA256 de
        "<t>.<cuerpo crudo>" con el secreto del endpoint. Se compara en tiempo
        constante y se rechaza lo viejo, para que un evento capturado no se
        pueda repetir despues. Sin secreto configurado no pasa nada: cerrado
        por defecto. Devuelve el evento, o null. */
    static function event($payload, $header) {
        $secret = self::env('STRIPE_WEBHOOK_SECRET');
        if ($secret === '') return null;

        $time = 0;
        $sigs = [];

        foreach (explode(',', (string) $header) as $part) {
            $pair = explode('=', trim($part), 2);
            if (count($pair) !== 2) continue;

            if ($pair[0] === 't')  $time   = (int) $pair[1];
            if ($pair[0] === 'v1') $sigs[] = $pair[1];
        }

        if ($time === 0 || abs(time() - $time) > self::TOLERANCE) return null;

        $expected = hash_hmac('sha256', $time . '.' . $payload, $secret);

        foreach ($sigs as $sig) {
            if (hash_equals($expected, $sig)) {
                $event = json_decode($payload, true);
                return is_array($event) && isset($event['id'], $event['type']) ? $event : null;
            }
        }

        return null;
    }
}
