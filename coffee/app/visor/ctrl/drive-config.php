<?php
/**
 * Configuracion del cliente Google Drive.
 * NOTA: Los paths estan fuera del webroot para evitar exposicion.
 */

define('DRIVE_CREDENTIALS_PATH', 'c:/wamp64/credentials/coffeedrive.json');
define('DRIVE_ROOT_FOLDER_ID',   '1EyGnlx7u1FaqPtZUYBRCgy2y_XAIXae_');
define('DRIVE_TOKEN_CACHE',      'c:/wamp64/credentials/coffeedrive-token.cache.json');
define('DRIVE_CA_BUNDLE',        'c:/wamp64/credentials/cacert.pem');
define('DRIVE_FOLDER_MIME',      'application/vnd.google-apps.folder');
