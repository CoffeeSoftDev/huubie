<?php
/*  Esqueleto de las paginas de pro/ que no son de un modulo con Bootstrap: el
    inicio y el perfil. Barra arriba, rail a la izquierda y el contenido en
    <section id="root">.

    La pagina lo incluye despues de revisar la sesion, con:
      $root    el camino de la pagina a pro/ ('../../' desde app/<pagina>/)
      $title   el titulo de la pestaña
      $active  (opcional) el item del rail que se marca: 'inicio' | 'perfil'
    y cierra con layout/scripts.php.

    Sin Bootstrap a proposito: su .bg-white y su .border llevan !important y le
    ganan a las utilidades de Tailwind con las que estan hechas estas paginas.

    #root es <section> y no <div>: general.css y dark-mode.css le ponen fondo de
    tarjeta y padding a `#main__content > div`, que es el contenedor de los
    modulos con tabla. Aqui el contenido son tarjetas sueltas sobre el fondo de
    la pagina. */
$asset = function ($file) use ($root) {
    return $root . $file . '?v=' . filemtime(__DIR__ . '/../' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Huubie · <?= htmlspecialchars($title) ?></title>
    <link rel="icon" href="<?= $root ?>assets/img/huubie192.png" type="image/png">

    <link rel="stylesheet" href="<?= $asset('assets/css/general.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/sidebar.css') ?>">

    <!-- tailwind-theme.js va JUSTO despues del CDN: le da la config y pinta la paleta guardada. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="<?= $asset('assets/js/tailwind-theme.js') ?>"></script>

    <!-- Tokens del tema activo: al final, redefine lo que las hojas de arriba dejaron fijo. -->
    <link rel="stylesheet" href="<?= $asset('assets/css/themes.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/dark-mode.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/page.css') ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>

<body>
    <div id="menu-sidebar"<?= empty($active) ? '' : ' data-active="' . htmlspecialchars($active) . '"' ?>></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <section id="root" class="pg"></section>
        </div>
    </main>
