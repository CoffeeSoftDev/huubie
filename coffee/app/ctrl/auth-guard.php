<?php
require_once __DIR__ . '/auth-session.php';
require_once __DIR__ . '/auth-db.php';
require_once __DIR__ . '/auth-helpers.php';

if (!auth_current_user()) {
    header('Location: ../index.php');
    exit;
}
