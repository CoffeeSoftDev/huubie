<?php
// Donde viven los secretos que NO son texto del .env: el CA bundle, el JSON de
// la cuenta de servicio de Drive y su cache de token.
//
// Antes eran rutas absolutas de la maquina de desarrollo (c:/wamp64/credentials).
// Al subir el proyecto a un servidor esa carpeta no existe, asi que Drive se
// quedaba sin credenciales y curl sin CA con el que validar SSL. Ahora los
// archivos viajan con el proyecto en coffee/app/credentials/ — carpeta cerrada
// por su .htaccess y excluida del control de versiones por su .gitignore — y la
// ruta vieja queda solo como respaldo para los equipos que aun la tengan.
//
// Se puede mandar la carpeta a otro sitio (por ejemplo, fuera del webroot en
// produccion) con CREDENTIALS_DIR en el .env.

if (!function_exists('coffee_credentials_dir')) {

    // Carpeta de credenciales del proyecto. Una ruta relativa en CREDENTIALS_DIR
    // se resuelve contra coffee/app/, que es lo que uno espera al escribirla.
    function coffee_credentials_dir() {
        static $dir = null;
        if ($dir !== null) return $dir;

        $base = str_replace('\\', '/', __DIR__ . '/../credentials');
        $env  = __DIR__ . '/../credentials/.env';

        if (file_exists($env)) {
            $parsed = @parse_ini_file($env, false, INI_SCANNER_TYPED);
            $custom = is_array($parsed) ? trim((string) ($parsed['CREDENTIALS_DIR'] ?? '')) : '';
            if ($custom !== '') {
                $custom = str_replace('\\', '/', $custom);
                $base = preg_match('#^([a-zA-Z]:/|/)#', $custom)
                    ? $custom
                    : str_replace('\\', '/', __DIR__ . '/../') . ltrim($custom, '/');
            }
        }

        $real = realpath($base);
        $dir  = rtrim($real === false ? $base : str_replace('\\', '/', $real), '/');
        return $dir;
    }

    // Carpeta historica, fuera del proyecto. Solo se consulta si el archivo no
    // esta en la del proyecto: en el servidor no existe y no estorba.
    function coffee_credentials_legacy_dir() {
        return 'c:/wamp64/credentials';
    }

    // Ruta de LECTURA de un secreto: la del proyecto si esta ahi, si no la
    // historica. Si no existe en ninguna se devuelve la del proyecto, que es la
    // que hay que crear (y la que conviene nombrar en los mensajes de error).
    function coffee_credential_path($name) {
        $name  = ltrim(str_replace('\\', '/', (string) $name), '/');
        $mine  = coffee_credentials_dir() . '/' . $name;
        if (file_exists($mine)) return $mine;

        $legacy = coffee_credentials_legacy_dir() . '/' . $name;
        return file_exists($legacy) ? $legacy : $mine;
    }

    // Ruta de ESCRITURA (caches de token): siempre dentro del proyecto, para no
    // dejar el archivo generado en una carpeta que el deploy no se lleva.
    function coffee_credential_write_path($name) {
        return coffee_credentials_dir() . '/' . ltrim(str_replace('\\', '/', (string) $name), '/');
    }
}
