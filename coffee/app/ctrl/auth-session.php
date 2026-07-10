<?php
if (session_status() === PHP_SESSION_NONE) {
    session_name('coffee_app_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
