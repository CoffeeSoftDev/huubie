<?php
/**
 * Cliente minimalista para Google Drive API v3 usando service account.
 * Autentica via JWT firmado (openssl) + token exchange, sin SDK.
 *
 * Operaciones:
 *  - listChildren($parentId, $type = 'all'|'folder'|'file')
 *  - findChildByName($parentId, $name, $isFolder = null)
 *  - createFolder($parentId, $name)
 *  - uploadFile($parentId, $filename, $tmpFile, $mime)
 *  - deleteItem($id)
 *  - renameItem($id, $newName)
 */

require_once __DIR__ . '/drive-config.php';

class DriveException extends Exception {}

class DriveClient {
    private $credentials;
    private $accessToken;
    private $tokenExpiry;

    public function __construct() {
        if (!file_exists(DRIVE_CREDENTIALS_PATH)) {
            throw new DriveException('Credenciales no encontradas: ' . DRIVE_CREDENTIALS_PATH);
        }
        $raw = file_get_contents(DRIVE_CREDENTIALS_PATH);
        $this->credentials = json_decode($raw, true);
        if (!$this->credentials || empty($this->credentials['private_key']) || empty($this->credentials['client_email'])) {
            throw new DriveException('JSON de credenciales invalido');
        }
        $this->loadToken();
    }

    /* ── Autenticacion ───────────────────────────────────── */

    private function loadToken() {
        if (file_exists(DRIVE_TOKEN_CACHE)) {
            $cached = json_decode(@file_get_contents(DRIVE_TOKEN_CACHE), true);
            if ($cached && isset($cached['expiry']) && $cached['expiry'] > time() + 60) {
                $this->accessToken = $cached['token'];
                $this->tokenExpiry = $cached['expiry'];
                return;
            }
        }
        $this->fetchToken();
    }

    private function fetchToken() {
        $now = time();
        $header  = self::b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $payload = self::b64url(json_encode([
            'iss'   => $this->credentials['client_email'],
            'scope' => 'https://www.googleapis.com/auth/drive',
            'aud'   => 'https://oauth2.googleapis.com/token',
            'iat'   => $now,
            'exp'   => $now + 3600,
        ]));
        $signatureInput = $header . '.' . $payload;
        $signature = '';
        if (!openssl_sign($signatureInput, $signature, $this->credentials['private_key'], 'SHA256')) {
            throw new DriveException('No se pudo firmar JWT');
        }
        $jwt = $signatureInput . '.' . self::b64url($signature);

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CAINFO         => DRIVE_CA_BUNDLE,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($code !== 200) {
            throw new DriveException("Token request fallo ($code): " . ($resp ?: $err));
        }
        $data = json_decode($resp, true);
        if (empty($data['access_token'])) {
            throw new DriveException('Respuesta de token sin access_token');
        }
        $this->accessToken = $data['access_token'];
        $this->tokenExpiry = $now + ($data['expires_in'] ?? 3600);

        @file_put_contents(DRIVE_TOKEN_CACHE, json_encode([
            'token'  => $this->accessToken,
            'expiry' => $this->tokenExpiry,
        ]));
    }

    /* ── Helpers HTTP ────────────────────────────────────── */

    private function apiRequest($method, $url, $body = null, $extraHeaders = []) {
        $headers = array_merge([
            'Authorization: Bearer ' . $this->accessToken,
            'Accept: application/json',
        ], $extraHeaders);

        $ch = curl_init($url);
        $opts = [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CAINFO         => DRIVE_CA_BUNDLE,
        ];
        if ($body !== null) $opts[CURLOPT_POSTFIELDS] = $body;
        curl_setopt_array($ch, $opts);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($code === 401) {
            // Token expirado en medio del request — refrescar y reintentar una vez
            $this->fetchToken();
            return $this->apiRequest($method, $url, $body, $extraHeaders);
        }
        if ($code < 200 || $code >= 300) {
            throw new DriveException("Drive API $method $url fallo ($code): " . ($resp ?: $err));
        }
        return $resp ? json_decode($resp, true) : null;
    }

    /* ── Operaciones publicas ───────────────────────────── */

    /**
     * Lista hijos de una carpeta. $type: 'all' | 'folder' | 'file'.
     */
    public function listChildren($parentId, $type = 'all') {
        $q = "'" . $parentId . "' in parents and trashed = false";
        if ($type === 'folder') $q .= " and mimeType = '" . DRIVE_FOLDER_MIME . "'";
        if ($type === 'file')   $q .= " and mimeType != '" . DRIVE_FOLDER_MIME . "'";

        $params = http_build_query([
            'q'       => $q,
            'fields'  => 'files(id, name, mimeType, size, modifiedTime)',
            'pageSize'=> 1000,
            'orderBy' => 'name',
        ]);
        $result = $this->apiRequest('GET', 'https://www.googleapis.com/drive/v3/files?' . $params);
        return $result['files'] ?? [];
    }

    /**
     * Lista todas las carpetas compartidas con la cuenta de servicio (no en su Drive, sino otras).
     * Util para auto-descubrir las carpetas que el usuario comparte con el SA.
     */
    public function listSharedFolders() {
        $params = http_build_query([
            'q'       => "sharedWithMe = true and mimeType = '" . DRIVE_FOLDER_MIME . "' and trashed = false",
            'fields'  => 'files(id, name, modifiedTime)',
            'pageSize'=> 100,
            'orderBy' => 'name',
        ]);
        $result = $this->apiRequest('GET', 'https://www.googleapis.com/drive/v3/files?' . $params);
        return $result['files'] ?? [];
    }

    public function findChildByName($parentId, $name, $isFolder = null) {
        $safe = str_replace("'", "\\'", $name);
        $q = "'" . $parentId . "' in parents and name = '" . $safe . "' and trashed = false";
        if ($isFolder === true)  $q .= " and mimeType = '" . DRIVE_FOLDER_MIME . "'";
        if ($isFolder === false) $q .= " and mimeType != '" . DRIVE_FOLDER_MIME . "'";

        $params = http_build_query([
            'q'      => $q,
            'fields' => 'files(id, name, mimeType)',
        ]);
        $result = $this->apiRequest('GET', 'https://www.googleapis.com/drive/v3/files?' . $params);
        return $result['files'][0] ?? null;
    }

    public function createFolder($parentId, $name) {
        $body = json_encode([
            'name'     => $name,
            'mimeType' => DRIVE_FOLDER_MIME,
            'parents'  => [$parentId],
        ]);
        return $this->apiRequest(
            'POST',
            'https://www.googleapis.com/drive/v3/files?fields=id,name',
            $body,
            ['Content-Type: application/json']
        );
    }

    public function uploadFile($parentId, $filename, $tmpFile, $mime = 'application/octet-stream') {
        $metadata = json_encode([
            'name'    => $filename,
            'parents' => [$parentId],
        ]);
        $content = file_get_contents($tmpFile);
        if ($content === false) throw new DriveException('No se pudo leer el archivo temporal');

        $boundary = 'huubie' . bin2hex(random_bytes(8));
        $body  = "--{$boundary}\r\n";
        $body .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
        $body .= $metadata . "\r\n";
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: {$mime}\r\n\r\n";
        $body .= $content . "\r\n";
        $body .= "--{$boundary}--";

        return $this->apiRequest(
            'POST',
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime',
            $body,
            ['Content-Type: multipart/related; boundary=' . $boundary]
        );
    }

    public function deleteItem($id) {
        return $this->apiRequest('DELETE', 'https://www.googleapis.com/drive/v3/files/' . urlencode($id));
    }

    /**
     * Descarga el contenido raw de un archivo (texto/binario).
     * NO funciona con Google Docs/Sheets/Slides nativos — usa exportFile() para esos.
     */
    public function downloadFile($id) {
        return $this->apiRequestRaw('GET', 'https://www.googleapis.com/drive/v3/files/' . urlencode($id) . '?alt=media');
    }

    /**
     * Exporta un Google Doc/Sheet/Slide nativo a un mime type especifico (ej. text/markdown, text/plain).
     */
    public function exportFile($id, $mimeType = 'text/markdown') {
        return $this->apiRequestRaw('GET', 'https://www.googleapis.com/drive/v3/files/' . urlencode($id) . '/export?mimeType=' . urlencode($mimeType));
    }

    /**
     * Obtiene el contenido de cualquier archivo eligiendo automaticamente download/export.
     * Para Google Docs nativos exporta a markdown; para los demas, descarga raw.
     */
    public function getFileContent($file) {
        $mime = $file['mimeType'] ?? '';
        if (strpos($mime, 'application/vnd.google-apps.') === 0) {
            switch ($mime) {
                case 'application/vnd.google-apps.document':
                    return $this->exportFile($file['id'], 'text/markdown');
                case 'application/vnd.google-apps.spreadsheet':
                    return $this->exportFile($file['id'], 'text/csv');
                case 'application/vnd.google-apps.presentation':
                    return $this->exportFile($file['id'], 'text/plain');
                default:
                    return $this->exportFile($file['id'], 'text/plain');
            }
        }
        return $this->downloadFile($file['id']);
    }

    /**
     * Variante de apiRequest que devuelve bytes raw (no parsea JSON).
     */
    private function apiRequestRaw($method, $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->accessToken],
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_CAINFO         => DRIVE_CA_BUNDLE,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($code === 401) {
            $this->fetchToken();
            return $this->apiRequestRaw($method, $url);
        }
        if ($code < 200 || $code >= 300) {
            throw new DriveException("Drive download $url fallo ($code): " . substr($body ?: $err, 0, 400));
        }
        return $body;
    }

    public function renameItem($id, $newName) {
        return $this->apiRequest(
            'PATCH',
            'https://www.googleapis.com/drive/v3/files/' . urlencode($id) . '?fields=id,name',
            json_encode(['name' => $newName]),
            ['Content-Type: application/json']
        );
    }

    /* ── Utils ──────────────────────────────────────────── */

    private static function b64url($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
