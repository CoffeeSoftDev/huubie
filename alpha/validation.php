<?php
session_start();

require_once "helpers/router.php";

$user = $_SESSION['USR'] ?? null;


$companyId = $_SESSION['COMPANY_ID'] ?? ($user['company_id'] ?? ($_SESSION['COMPANY'] ?? null));


$route = isset($_GET['route']) ? trim($_GET['route'], '/') : '';

if (!$user) {
    include "index.php";
    exit;
}

if (!$companyId) {
    include "access/denied.php";
    exit;
}

if ($route == '') {
    header('Location: /alpha/ventas/');
    exit;
}

$router = new Routes();
$routes = $router->getRoutesByCompany([$companyId]);

$found = null;
if (is_array($routes)) {
    $needle = strtolower($route);
    foreach ($routes as $r) {
        $current = strtolower(trim($r['route'], '/'));
        if ($current == $needle) {
            $found = $r;
            break;
        }
    }
}

if (!$found) {
    include "access/404.php";
    exit;
}

$file = isset($found['file_path']) ? $found['file_path'] : null;
if (!$file) {
    include "access/404.php";
    exit;
}

$full = __DIR__ . '/' . ltrim($file, '/');
if (!file_exists($full)) {
    include "access/404.php";
    exit;
}


writeAccessLog([
            'user'     => $found
        ]);

include $full;

exit;


 function writeAccessLog($data) {
        $logDir  = 'access/log';
        $logFile = $logDir . '/access_' . date('Y-m-d') . '.log';

        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        $timestamp = date('Y-m-d H:i:s');
        $logEntry  = sprintf(
            $data['user'] ?? 'N/A',
   
        );

        file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }