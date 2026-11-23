<?php
/*  La lista de pedidos ahora es lista-pedidos.php. Este archivo solo
    redirige los enlaces viejos (marcadores, la ruta del menu mientras no
    corra 2026-11-20_ruta-lista-pedidos.sql), con su ?vista= y ?from=. */
$query = $_SERVER['QUERY_STRING'] ?? '';

header('Location: lista-pedidos.php' . ($query !== '' ? '?' . $query : ''));
exit;
