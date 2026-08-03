<?php

// Sesion de desarrollo del Facturador.
//
// El modulo se abre solo, sin pasar por el login de /app/, para poder trabajarlo
// sin arrastrar el resto de Huubie. Lo que siembra son los mismos datos que la
// sesion real deja: el id de usuario que usan los controladores y los rotulos
// que consume el navbar.
//
// TRES CANDADOS, y basta con que uno cierre para que no se siembre nada:
//
//   1. Solo si NO hay sesion. Una sesion real de Huubie nunca se pisa.
//   2. Solo si FACTURE_DEV_SESSION esta encendida (se apaga en conf/_Rutes.php).
//   3. Solo en local. Es el candado que importa: si este archivo llega al
//      servidor no abre nada, porque ahi ni la ip es de loopback ni el dominio
//      esta en la lista.
//
// La sesion sembrada se marca con FACTURE_DEV para que la pantalla lo diga. Una
// sesion falsa que no se anuncia es peor que no tenerla: cualquiera creeria que
// esta viendo datos de su propio usuario.

// Interruptores. Van aqui y no en _Rutes.php porque login.php tambien los
// necesita, y esa pantalla no puede pasar por el guard (el guard es justo lo que
// la manda a ella). Con defined() se pueden fijar antes desde fuera.
//
//   FACTURE_DEV_SESSION  enciende todo el mecanismo. En false el modulo exige
//                        login real tambien en local y login.php no abre.
//   FACTURE_DEV_AUTO     entra sin preguntar, con el perfil por defecto. En
//                        false el modulo manda a login.php a elegir perfil.
if (!defined('FACTURE_DEV_SESSION')) define('FACTURE_DEV_SESSION', true);
if (!defined('FACTURE_DEV_AUTO'))    define('FACTURE_DEV_AUTO', true);

// Hosts de trabajo local. El vhost del proyecto va aqui; agregar otro es sumarlo
// a esta lista, no tocar la logica.
define('FACTURE_LOCAL_HOSTS', [
    'localhost',
    '127.0.0.1',
    '::1',
    'www.cs-huubie.com',
    'cs-huubie.com'
]);

// Perfiles con los que se puede entrar. No son usuarios de la base: son juegos
// de datos de sesion para ver el modulo desde distintos puestos. USR es el unico
// con peso real, porque los controladores lo guardan como autor de la carga.
function factureDevPerfiles() {
    return [
        'admin' => [
            'titulo' => 'Administrador',
            'nota'   => 'Acceso completo al facturador',
            'icono'  => 'shield-check',
            'sesion' => [
                'USR'              => 1,
                'USER'             => 'Administrador',
                'EMAIL'            => 'admin@local',
                'ROL'              => 'Administrador',
                'COMPANY'          => 'CoffeeSoft',
                'SUBSIDIARIE_NAME' => 'Matriz'
            ]
        ],
        'factura' => [
            'titulo' => 'Facturacion',
            'nota'   => 'El puesto que carga y timbra',
            'icono'  => 'receipt-text',
            'sesion' => [
                'USR'              => 2,
                'USER'             => 'Facturacion',
                'EMAIL'            => 'facturacion@local',
                'ROL'              => 'Facturacion',
                'COMPANY'          => 'CoffeeSoft',
                'SUBSIDIARIE_NAME' => 'Poliforum'
            ]
        ],
        'sucursal' => [
            'titulo' => 'Sucursal',
            'nota'   => 'Consulta lo suyo, no administra',
            'icono'  => 'store',
            'sesion' => [
                'USR'              => 3,
                'USER'             => 'Sucursal',
                'EMAIL'            => 'sucursal@local',
                'ROL'              => 'Sucursal',
                'COMPANY'          => 'CoffeeSoft',
                'SUBSIDIARIE_NAME' => 'Poliforum'
            ]
        ]
    ];
}

// Local es cumplir LAS DOS condiciones, y son dos a proposito:
//
//   la ip de origen es la propia maquina, que el cliente no puede falsificar;
//   y el dominio es uno de los de trabajo.
//
// Con una sola no alcanza. HTTP_HOST lo pone quien llama, asi que bastaria un
// "Host: localhost" contra el servidor para sembrar la sesion desde fuera; y la
// ip de loopback sola abriria el modulo a cualquier peticion que el propio
// servidor se hiciera a si mismo.
//
// Los sufijos .local y .test cubren los vhosts que se den de alta despues sin
// tener que volver aqui.
function factureEsLocal() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    if (!in_array($ip, ['127.0.0.1', '::1'], true)) return false;

    $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);

    if (in_array($host, FACTURE_LOCAL_HOSTS, true)) return true;

    return substr($host, -6) === '.local' || substr($host, -5) === '.test';
}

// Puede el modulo abrirse con sesion de desarrollo. Es la pregunta que se hacen
// tanto el guard como login.php, y responde a los candados que no dependen del
// perfil elegido.
function factureDevPermitido() {
    if (!defined('FACTURE_DEV_SESSION') || !FACTURE_DEV_SESSION) return false;

    return factureEsLocal();
}

// Entra con un perfil. Es lo que llama login.php al elegir, y tambien la entrada
// automatica. No pregunta por sesion previa: quien la llama ya decidio.
function factureEntrarComo($clave) {
    if (!factureDevPermitido()) return false;

    $perfiles = factureDevPerfiles();

    if (!isset($perfiles[$clave])) return false;

    foreach ($perfiles[$clave]['sesion'] as $llave => $valor) $_SESSION[$llave] = $valor;

    // La sucursal del facturador NO se siembra: vive en su propio esquema y
    // resolveBranch() la resuelve contra su tabla branch la primera vez.
    $_SESSION['FACTURE_DEV']         = true;
    $_SESSION['FACTURE_DEV_PERFIL']  = $clave;

    return true;
}

// Cierra la sesion de desarrollo. Solo toca las suyas: si la sesion es real no
// hace nada, para que salir del facturador no desloguee de Huubie.
function factureSalirDev() {
    if (empty($_SESSION['FACTURE_DEV'])) return false;

    $_SESSION = [];

    if (session_status() === PHP_SESSION_ACTIVE) session_destroy();

    return true;
}

// Entrada automatica: siembra el perfil por defecto si los candados lo permiten.
// Devuelve si la sembro.
function factureSesionDev() {
    if (isset($_SESSION['USR'])) return false;

    if (!defined('FACTURE_DEV_AUTO') || !FACTURE_DEV_AUTO) return false;

    return factureEntrarComo('admin');
}

// Pega el distintivo de sesion de desarrollo antes de cerrar el body.
//
// Va por buffer de salida y no en un layout porque las seis paginas del modulo
// comparten el head de Huubie, y ese no se toca por una marca de desarrollo. De
// paso queda a salvo de los endpoints: una respuesta JSON no trae </body> y sale
// intacta.
function factureDevRibbon($html) {
    $pos = strripos($html, '</body>');

    if ($pos === false) return $html;

    $perfil = $_SESSION['FACTURE_DEV_PERFIL'] ?? '';
    $lista  = factureDevPerfiles();
    $titulo = $lista[$perfil]['titulo'] ?? 'Desarrollo';

    // La cinta es tambien el camino de vuelta al login: sin ella habria que
    // escribir la url a mano para cambiar de perfil o salir.
    $tag = '
    <style>
        .facture-dev-tag {
            position: fixed;
            right: 0;
            bottom: 0;
            z-index: 2147483000;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 10px 5px;
            border-top-left-radius: 6px;
            background: #B45309;
            color: #FFF7E6;
            font: 700 10px/1 -apple-system, "Segoe UI", sans-serif;
            letter-spacing: .06em;
            text-transform: uppercase;
        }

        .facture-dev-tag b {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #FFF7E6;
        }

        .facture-dev-tag a {
            color: #FFF7E6;
            text-decoration: underline;
            text-underline-offset: 2px;
            opacity: .75;
        }

        .facture-dev-tag a:hover { opacity: 1; }
    </style>
    <div class="facture-dev-tag" title="Sesion sembrada en local por conf/dev-session.php. No es un usuario real.">
        <b></b>Dev · ' . htmlspecialchars($titulo) . '
        <a href="/app/facture/login.php">cambiar</a>
    </div>
    ';

    return substr($html, 0, $pos) . $tag . substr($html, $pos);
}
