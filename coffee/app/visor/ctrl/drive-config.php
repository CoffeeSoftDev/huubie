<?php
/**
 * Configuracion del cliente Google Drive.
 * Los archivos viven en coffee/app/credentials/, cerrada por .htaccess y fuera
 * del control de versiones. Antes eran rutas absolutas de la maquina local
 * (c:/wamp64/credentials), que no existen al subir el proyecto al servidor;
 * esa ruta sigue sirviendo de respaldo (ver ctrl/credentials-path.php).
 */
require_once __DIR__ . '/../../ctrl/credentials-path.php';

define('DRIVE_CREDENTIALS_PATH', coffee_credential_path('coffeedrive.json'));
define('DRIVE_ROOT_FOLDER_ID',   '1EyGnlx7u1FaqPtZUYBRCgy2y_XAIXae_');
// El cache de token se escribe en cada renovacion: siempre dentro del proyecto.
define('DRIVE_TOKEN_CACHE',      coffee_credential_write_path('coffeedrive-token.cache.json'));
define('DRIVE_CA_BUNDLE',        coffee_credential_path('cacert.pem'));
define('DRIVE_FOLDER_MIME',      'application/vnd.google-apps.folder');
