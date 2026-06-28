<?php
/**
 * Configuracion del cliente de GitHub (GraphQL API para Projects v2).
 * Lee el token desde coffee/app/credentials/.env (el mismo .env de Ollama/OpenRouter).
 *
 * A diferencia de los otros config, NO lanza excepcion fatal si falta el token:
 * el ctrl decide como responder (error JSON controlado) para no romper la UI.
 */

define('GITHUB_ENV_PATH', __DIR__ . '/../../credentials/.env');

$_GITHUB_ENV = [];
if (file_exists(GITHUB_ENV_PATH)) {
    $parsed = parse_ini_file(GITHUB_ENV_PATH, false, INI_SCANNER_TYPED);
    if (is_array($parsed)) {
        $_GITHUB_ENV = $parsed;
    }
}

define('GITHUB_TOKEN',       trim((string)($_GITHUB_ENV['GITHUB_TOKEN'] ?? '')));
define('GITHUB_API_TIMEOUT', (int)($_GITHUB_ENV['GITHUB_API_TIMEOUT'] ?? 30));
define('GITHUB_GRAPHQL_URL', 'https://api.github.com/graphql');

// CA bundle para validar el SSL de api.github.com. En WAMP, PHP no trae uno por
// defecto (curl.cainfo vacio), asi que reusamos el mismo cacert.pem que ya usa el
// cliente de Google Drive. Permite override por .env (GITHUB_CA_BUNDLE).
$_GH_CA = (string)($_GITHUB_ENV['GITHUB_CA_BUNDLE'] ?? '');
if ($_GH_CA === '' && file_exists('c:/wamp64/credentials/cacert.pem')) {
    $_GH_CA = 'c:/wamp64/credentials/cacert.pem';
}
define('GITHUB_CA_BUNDLE', $_GH_CA);

unset($_GITHUB_ENV, $_GH_CA);

/** True si hay un token configurado. */
function github_has_token(): bool
{
    return GITHUB_TOKEN !== '';
}

/**
 * Ejecuta una query GraphQL contra GitHub y devuelve el array decodificado.
 * Lanza RuntimeException ante errores de red / HTTP / token.
 *
 * @param string $query     Query GraphQL.
 * @param array  $variables Variables de la query.
 * @return array Respuesta JSON decodificada (incluye 'data' y/o 'errors').
 */
function github_graphql(string $query, array $variables = []): array
{
    if (!github_has_token()) {
        throw new RuntimeException('Falta GITHUB_TOKEN en coffee/app/credentials/.env');
    }

    $payload = json_encode(['query' => $query, 'variables' => (object)$variables], JSON_UNESCAPED_UNICODE);

    $ch = curl_init(GITHUB_GRAPHQL_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => GITHUB_API_TIMEOUT,
        CURLOPT_HTTPHEADER     => [
            'Authorization: bearer ' . GITHUB_TOKEN,
            'Content-Type: application/json',
            'User-Agent: Huubie-Visor-CoffeeIA',
        ],
    ]);
    if (GITHUB_CA_BUNDLE !== '' && file_exists(GITHUB_CA_BUNDLE)) {
        curl_setopt($ch, CURLOPT_CAINFO, GITHUB_CA_BUNDLE);
    }

    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res === false) {
        throw new RuntimeException('Error de red al consultar GitHub: ' . $err);
    }
    if ($code === 401) {
        throw new RuntimeException('Token de GitHub invalido o sin permisos (401).');
    }
    if ($code >= 400) {
        throw new RuntimeException("GitHub respondio HTTP $code.");
    }

    $data = json_decode($res, true);
    if (!is_array($data)) {
        throw new RuntimeException('Respuesta no valida de GitHub.');
    }
    return $data;
}
