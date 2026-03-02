<?php
session_start();

if (empty($_SESSION["IDU"])) {
    header("Location: index.php");
    exit();
}

require_once 'conf/_Conect.php';
require_once 'conf/_CRUD.php';
require_once 'conf/_Utileria.php';

$DB_ALMACEN = "fayxzvov_almacen.";
$DB_ERP     = "fayxzvov_erp.";
