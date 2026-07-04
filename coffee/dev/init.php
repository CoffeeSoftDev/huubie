<?php
session_start();

if (empty($_SESSION["IDU"])) {
    header("Location: index.php");
    exit();
}

require_once 'conf/_Conect.php';
require_once 'conf/_CRUD.php';
require_once 'conf/_Utileria.php';

$DB_GV_ERP = "rfwsmqex_gv_erp.";
