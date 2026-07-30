<?php
// Identidad de la sesion para el front. Se emite ANTES de los scripts de cada
// pagina porque varios de ellos deciden en su primera linea con que clave leen
// localStorage: sin esto tendrian que esperar a una peticion y, mientras tanto,
// arrancarian con el estado de la cuenta anterior.
//
// No lleva datos sensibles: solo el id con el que se separa el almacenamiento
// local y el nombre para mostrar. Quien manda de verdad es la sesion del
// servidor — el front no puede cambiar de cuenta reescribiendo esto.
require_once __DIR__ . '/../ctrl/library-roots.php';

$coffeeUserKey  = coffee_visor_user_key();
$coffeeUserName = '';
if (function_exists('auth_current_user')) {
    $u = auth_current_user();
    if ($u && !empty($u['name'])) $coffeeUserName = $u['name'];
}
?>
<script>
window.COFFEE_USER = {
    id:   <?php echo json_encode($coffeeUserKey, JSON_UNESCAPED_UNICODE); ?>,
    name: <?php echo json_encode($coffeeUserName, JSON_UNESCAPED_UNICODE); ?>
};
// Sufijo para cualquier clave de localStorage que deba ser privada de la cuenta:
// dos personas en el mismo navegador no comparten hilos, ajustes ni archivados.
window.coffeeScopedKey = function (key) {
    var id = (window.COFFEE_USER && window.COFFEE_USER.id) || '_guest';
    return key + '::u' + id;
};
</script>
