<?php
// -- Etiquetas PWA (manifest, iconos, service worker) --
// Se incluye dentro del <head> del login y de cada página del visor.
// La base se calcula sola: sirve tanto en coffee/app/ como en coffee/app/visor/,
// y da igual si el vhost apunta a la raíz del proyecto o a la carpeta app.
$pwaBase = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
if (basename($pwaBase) === 'visor') {
    $pwaBase = str_replace('\\', '/', dirname($pwaBase));
}
$pwaBase = rtrim($pwaBase, '/.');
?>
<link rel="manifest" href="<?php echo $pwaBase; ?>/manifest.json">
<meta name="theme-color" content="#C05A40">
<meta name="application-name" content="CoffeeSoft">
<meta name="mobile-web-app-capable" content="yes">
<!-- iOS ignora el manifest: necesita sus propias etiquetas -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="CoffeeSoft">
<link rel="apple-touch-icon" href="<?php echo $pwaBase; ?>/src/img/pwa/apple-touch-icon.png">
<link rel="stylesheet" href="<?php echo $pwaBase; ?>/src/css/pwa.css">
<script>window.PWA_BASE = <?php echo json_encode($pwaBase); ?>;</script>
<script src="<?php echo $pwaBase; ?>/src/js/pwa.js?t=<?php echo time(); ?>" defer></script>
