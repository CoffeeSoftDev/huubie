<?php
// Pedidos se separó el 19/10/2026 en Requisiciones (quien pide) y Despacho (quien surte).
// Esta ruta queda para enlaces y avisos viejos: con ?pedido= (la campana abría ese pedido en
// Mis entregas) va a Despacho; sin él, a Requisiciones.
$destino = isset($_GET['pedido']) ? 'despacho.php' : 'requisiciones.php';
$query   = $_SERVER['QUERY_STRING'] ?? '';

header('Location: ' . $destino . ($query !== '' ? '?' . $query : ''));
exit();
