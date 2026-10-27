<?php
// Comprobante de una requisición por enlace (Compartir por WhatsApp): se abre SIN sesión,
// solo con la llave `t` (purchase_order.share_token). El mismo documento de Imprimir, pintado
// por js/ordenes.js (Ordenes.verComprobante); el ctrl responde getComprobante sin pedir login.
$token = preg_match('/^[a-f0-9]{32}$/', $_GET['t'] ?? '') ? $_GET['t'] : '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" href="../../src/img/logos/favicon.svg" type="image/svg+xml">
    <title>Comprobante de requisición</title>
    <script src="../../src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../src/js/coffeeSoft.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/coffeeSoft.js'); ?>"></script>
</head>
<body>
    <div id="root"></div>
    <script>window.REQUISICION_TOKEN = <?php echo json_encode($token ?: 'sin-llave'); ?>;</script>
    <script src="js/ordenes.js?v=<?php echo filemtime(__DIR__ . '/js/ordenes.js'); ?>"></script>
</body>
</html>
