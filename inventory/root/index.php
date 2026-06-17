<?php
session_start();

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../acceso/ctrl/ctrl-logout.php');
    exit();
}

// El módulo Root renderiza su PRIMERA sección por orden. Se lee de la tabla
// sections (módulo code='root') para respetar el orden configurado; si falla,
// cae a la página de tenant.
require_once '../conf/_CRUD.php';

class RootIndexQuery extends CRUD {}

$db   = new RootIndexQuery();
$rows = $db->_Read(
    "SELECT s.route
       FROM fayxzvov_erp.sections s
       JOIN fayxzvov_erp.modules m ON m.id = s.module_id
      WHERE m.code = 'root' AND s.is_active = 1
      ORDER BY s.orden ASC, s.id ASC
      LIMIT 1",
    null
);
$route = !empty($rows[0]['route']) ? $rows[0]['route'] : 'root/tenant.php';

// route es relativa a /inventory/. Redirige a la URL absoluta del host.
$invUrl = dirname(dirname($_SERVER['PHP_SELF']));  // .../inventory
header('Location: ' . rtrim($invUrl, '/') . '/' . ltrim($route, '/'));
exit();
