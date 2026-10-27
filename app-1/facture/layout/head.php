<?php
// Datos de sesion de app/ que consume src/js/navbar.js (sin fetch). Si la
// sesion no trae el dato, cae al valor de muestra para que el modulo se vea
// completo en la Fase 1.
$factureSession = [
    'user'     => $_SESSION['USER']             ?? 'Usuario',
    'email'    => $_SESSION['EMAIL']            ?? '',
    'rol'      => $_SESSION['ROL']              ?? 'Sin rol',
    'company'  => $_SESSION['COMPANY']          ?? 'CoffeeSoft',
    'negocio'  => $_SESSION['COMPANY']          ?? 'CoffeeSoft',
    'sucursal' => $_SESSION['SUBSIDIARIE_NAME'] ?? 'Matriz',
];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="/app/facture/src/img/logos/coffee_icon.png" type="image/x-icon">
    <title>Coffee · Facturador SAT</title>

    <!--BOOTSTRAP-->
    <link rel="stylesheet" href="/app/facture/src/plugin/bootstrap-5/css/bootstrap.min.css">
    <!--SWEETALERT-->
    <link rel="stylesheet" href="/app/facture/src/plugin/sweetalert2/sweetalert2.min.css">
    <!--DATATABLES-->
    <link rel="stylesheet" href="/app/facture/src/plugin/datatables/dataTables.responsive.min.css">
    <link rel="stylesheet" href="/app/facture/src/plugin/datatables/1.13.6/css/dataTables.bootstrap5.min.css">

    <link rel="stylesheet" href="/app/facture/src/plugin/daterangepicker/daterangepicker.css">
    <!--SELECT2-->
    <link rel="stylesheet" href="/app/facture/src/plugin/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="/app/facture/src/plugin/select2/bootstrap/select2-bootstrap-5-theme.min.css">

    <!--PERSONALIZADO-->
    <!-- general.css con cache-buster: trae el fix del alert Swal que contraia el
         container (position:fixed sobre .swal2-container en body flex-row). Evita
         que el navegador sirva una copia vieja cacheada. -->
    <link rel="stylesheet" href="/app/facture/src/css/general.css?v=<?php echo filemtime(__DIR__ . '/../src/css/general.css'); ?>">
    <link rel="stylesheet" href="/app/facture/src/css/colors.css">
    <link rel="stylesheet" href="/app/facture/src/css/table.css">
    <link rel="stylesheet" href="/app/facture/src/css/buttons.css">
    <link rel="stylesheet" href="/app/facture/src/css/background.css">
    <link rel="stylesheet" href="/app/facture/src/css/text.css">
    <link rel="stylesheet" href="/app/facture/src/css/style.css">
    <link rel="stylesheet" href="/app/facture/src/css/sidebar.css">

    <!-- CDN TAILWIND -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Tema Arcilla Invernal (blue -> terracota) -->
    <script src="/app/facture/src/js/tailwind-theme.js"></script>

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- Compact Styles -->
    <link rel="stylesheet" href="/app/facture/src/css/compact.css">

    <!-- Sesion de app/ para el navbar -->
    <script>
        window.FACTURE_SESSION = <?php echo json_encode($factureSession, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
    </script>
