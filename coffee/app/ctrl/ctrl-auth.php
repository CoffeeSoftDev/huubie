<?php
require_once __DIR__ . '/auth-session.php';
require_once __DIR__ . '/auth-config.php';
require_once __DIR__ . '/auth-db.php';
require_once __DIR__ . '/auth-helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function auth_action_register()
{
    $name            = trim($_POST['name'] ?? '');
    $email           = trim($_POST['email'] ?? '');
    $password        = (string)($_POST['password'] ?? '');
    $passwordConfirm = (string)($_POST['password_confirm'] ?? '');

    if ($name === '' || $email === '') {
        echo json_encode(['success' => false, 'message' => 'Nombre y correo son obligatorios']);
        return;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'El correo no es valido']);
        return;
    }
    if (mb_strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'La contrasena debe tener al menos 8 caracteres']);
        return;
    }
    if ($password !== $passwordConfirm) {
        echo json_encode(['success' => false, 'message' => 'Las contrasenas no coinciden']);
        return;
    }
    if (auth_find_by_email($email)) {
        echo json_encode(['success' => false, 'message' => 'Ese correo ya esta registrado']);
        return;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $now  = date('Y-m-d H:i:s');

    $st = auth_pdo()->prepare('INSERT INTO users (email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    $st->execute([$email, $name, $hash, $now, $now]);

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)auth_pdo()->lastInsertId();

    echo json_encode(['success' => true, 'redirect' => 'visor/index.php']);
}

function auth_action_login()
{
    $email    = trim($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    $genericError = 'Correo y/o contrasena incorrectos';

    $u = auth_find_by_email($email);
    if (!$u || $u['password_hash'] === null) {
        echo json_encode(['success' => false, 'message' => $genericError]);
        return;
    }
    if (!password_verify($password, $u['password_hash'])) {
        echo json_encode(['success' => false, 'message' => $genericError]);
        return;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$u['id'];

    echo json_encode(['success' => true, 'redirect' => 'visor/index.php']);
}

function auth_action_google()
{
    if (!auth_google_configured()) {
        echo json_encode(['success' => false, 'message' => 'El inicio de sesion con Google no esta configurado todavia']);
        return;
    }

    $credential = trim($_POST['credential'] ?? '');
    if ($credential === '') {
        echo json_encode(['success' => false, 'message' => 'Falta el token de Google']);
        return;
    }

    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    if (AUTH_CA_BUNDLE !== '' && file_exists(AUTH_CA_BUNDLE)) {
        curl_setopt($ch, CURLOPT_CAINFO, AUTH_CA_BUNDLE);
    }
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res === false || $code !== 200) {
        echo json_encode(['success' => false, 'message' => 'No se pudo verificar la cuenta de Google']);
        return;
    }

    $data = json_decode($res, true);
    if (!is_array($data)) {
        echo json_encode(['success' => false, 'message' => 'Respuesta invalida de Google']);
        return;
    }

    $issOk = in_array($data['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true);
    $audOk = ($data['aud'] ?? '') === GOOGLE_CLIENT_ID;
    $emailVerified = in_array($data['email_verified'] ?? '', ['true', true], true);

    if (!$issOk || !$audOk || !$emailVerified) {
        echo json_encode(['success' => false, 'message' => 'No se pudo verificar la cuenta de Google']);
        return;
    }

    $googleId = (string)($data['sub'] ?? '');
    $email    = (string)($data['email'] ?? '');
    $name     = (string)($data['name'] ?? $email);
    $picture  = $data['picture'] ?? null;

    if ($googleId === '' || $email === '') {
        echo json_encode(['success' => false, 'message' => 'Respuesta incompleta de Google']);
        return;
    }

    $now = date('Y-m-d H:i:s');
    $u   = auth_find_by_google_id($googleId);

    if (!$u) {
        $u = auth_find_by_email($email);
        if ($u) {
            $st = auth_pdo()->prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), updated_at = ? WHERE id = ?');
            $st->execute([$googleId, $picture, $now, $u['id']]);
            $u = auth_find_by_id((int)$u['id']);
        } else {
            $st = auth_pdo()->prepare('INSERT INTO users (email, name, avatar_url, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
            $st->execute([$email, $name, $picture, $googleId, $now, $now]);
            $u = auth_find_by_id((int)auth_pdo()->lastInsertId());
        }
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$u['id'];

    echo json_encode(['success' => true, 'redirect' => 'visor/index.php']);
}

function auth_action_logout()
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();

    echo json_encode(['success' => true, 'redirect' => '../index.php']);
}

function auth_action_me()
{
    $u = auth_current_user();
    echo json_encode(['success' => true, 'user' => $u ? auth_public_user($u) : null]);
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        auth_action_register();
        break;
    case 'login':
        auth_action_login();
        break;
    case 'google':
        auth_action_google();
        break;
    case 'logout':
        auth_action_logout();
        break;
    case 'me':
        auth_action_me();
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Accion no reconocida']);
}
