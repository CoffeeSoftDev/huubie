<?php

// Entrada de desarrollo del Facturador.
//
// NO es un login: no valida contra nada, no hay contrasena y no consulta la base
// de usuarios. Solo siembra un juego de datos de sesion para ver el modulo desde
// distintos puestos sin montar el login de Huubie.
//
// La pantalla vive detras de los mismos candados que la siembra automatica: si
// la peticion no es local, no se dibuja nada y sale al login real.

session_start();

require_once __DIR__ . '/conf/dev-session.php';

if (!factureDevPermitido()) {
    header('Location: /app/');
    exit();
}

// Salir vuelve aqui, no al login de Huubie: cerrar sesion en el facturador no
// tiene por que desloguear del resto del sistema.
if (isset($_GET['salir'])) {
    factureSalirDev();
    header('Location: /app/facture/login.php');
    exit();
}

$perfiles = factureDevPerfiles();
$destino  = $_POST['ir'] ?? $_GET['ir'] ?? '';

// Solo rutas internas del facturador, y sin '//' al principio: sin esta guarda
// un ?ir= con una url ajena convertiria la pantalla en un redirector abierto.
if (strpos($destino, '/app/facture/') !== 0 || strpos($destino, '//') === 0) {
    $destino = '/app/facture/index.php';
}

// Volver al propio login dejaria al usuario dando vueltas.
if (strpos($destino, '/app/facture/login.php') === 0) $destino = '/app/facture/index.php';

if (!empty($_POST['perfil']) && factureEntrarComo($_POST['perfil'])) {
    header('Location: ' . $destino);
    exit();
}

$activo = $_SESSION['FACTURE_DEV_PERFIL'] ?? '';

?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico">
    <title>Facturador · Entrada de desarrollo</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>

    <style>
        body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

        /* El foco se ve: la pantalla se recorre con teclado tanto como con raton. */
        .perfil:focus-visible {
            outline: 2px solid #1C64F2;
            outline-offset: 2px;
        }
    </style>
</head>

<body class="bg-[#111928] text-white min-h-screen flex items-center justify-center p-5">

    <main class="w-full max-w-[520px] flex flex-col gap-5">

        <header class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-[#1F2A37] border border-[#374151] flex items-center justify-center text-gray-300">
                    <i data-lucide="receipt-text" class="w-5 h-5"></i>
                </div>
                <div>
                    <h1 class="text-lg font-bold leading-tight">Facturador SAT</h1>
                    <p class="text-[12px] text-gray-400 leading-tight">Entrada de desarrollo</p>
                </div>
            </div>

            <!-- El aviso va arriba y no al pie: lo primero que hay que saber de
                 esta pantalla es que no autentica a nadie. -->
            <p class="mt-2 flex items-start gap-2 text-[12px] text-[#FCD34D] bg-[rgba(245,158,11,.10)]
                      border border-[rgba(245,158,11,.30)] rounded-lg px-3 py-2">
                <i data-lucide="triangle-alert" class="w-4 h-4 flex-shrink-0 mt-px"></i>
                <span>Estos perfiles no existen en la base y no se valida ninguna contrasena.
                    La pantalla solo abre en local.</span>
            </p>
        </header>

        <form method="post" class="flex flex-col gap-2">
            <input type="hidden" name="ir" value="<?php echo htmlspecialchars($destino); ?>">

            <?php foreach ($perfiles as $clave => $perfil): ?>
                <button type="submit" name="perfil" value="<?php echo htmlspecialchars($clave); ?>"
                        class="perfil w-full flex items-center gap-3 text-left p-3 rounded-lg border transition-colors
                               <?php echo $clave === $activo
                                   ? 'bg-[rgba(28,100,242,.12)] border-blue-400'
                                   : 'bg-[#1F2A37] border-[#374151] hover:border-gray-500'; ?>">
                    <span class="w-9 h-9 rounded-lg bg-[#141d2b] border border-[#374151]
                                 flex items-center justify-center text-gray-300 flex-shrink-0">
                        <i data-lucide="<?php echo htmlspecialchars($perfil['icono']); ?>" class="w-4 h-4"></i>
                    </span>
                    <span class="flex-1 min-w-0">
                        <span class="block text-[13px] font-bold text-white"><?php echo htmlspecialchars($perfil['titulo']); ?></span>
                        <span class="block text-[11px] text-gray-400"><?php echo htmlspecialchars($perfil['nota']); ?></span>
                    </span>
                    <span class="text-[10px] font-mono text-gray-500 flex-shrink-0">
                        USR <?php echo (int) $perfil['sesion']['USR']; ?>
                    </span>
                    <i data-lucide="arrow-right" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>
                </button>
            <?php endforeach; ?>
        </form>

        <footer class="flex items-center justify-between gap-3 pt-3 border-t border-[#374151]">
            <p class="text-[11px] text-gray-500">
                <?php if ($activo): ?>
                    Sesion abierta como <span class="text-gray-300 font-semibold"><?php echo htmlspecialchars($perfiles[$activo]['titulo'] ?? $activo); ?></span>
                <?php else: ?>
                    Sin sesion
                <?php endif; ?>
            </p>

            <div class="flex items-center gap-3">
                <?php if ($activo): ?>
                    <a href="/app/facture/login.php?salir=1" class="text-[11px] text-gray-400 hover:text-white">Cerrar sesion</a>
                <?php endif; ?>
                <a href="/app/" class="text-[11px] text-blue-300 hover:text-blue-200">Ir al login real</a>
            </div>
        </footer>

    </main>

    <script>
        if (window.lucide) lucide.createIcons();
    </script>

</body>

</html>
