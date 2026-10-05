<?php

// Candado de los controladores de la terminal (punto 34).
//
// Las paginas piden su permiso con wansoftExige() (conf/_Rutes.php), pero esa guarda
// solo esconde la pantalla: el controlador al que la pantalla llama quedaba abierto
// y respondia a cualquiera que conociera su direccion. Este es el mismo candado del
// lado del servidor, con respuesta JSON en vez de redireccion porque quien llama es
// un fetch.
//
// Sin PIN tecleado responde 401; con PIN pero sin el permiso de la pantalla, 403.
// Basta con uno de los permisos de la lista: el controlador de cargas lo usan dos
// pantallas con permisos distintos. Sin lista, solo pide que haya alguien adentro.
function terminalExige($permisos = []) {
    if (empty($_SESSION['WANSOFT_USER'])) {
        echo json_encode(['status' => 401, 'message' => 'Sin sesión en la terminal: vuelve a teclear tu PIN']);
        exit(0);
    }

    if (empty($permisos)) return;

    if (array_intersect($permisos, $_SESSION['WANSOFT_PERMS'] ?? [])) return;

    echo json_encode(['status' => 403, 'message' => 'Sin permiso para esta opción']);
    exit(0);
}
