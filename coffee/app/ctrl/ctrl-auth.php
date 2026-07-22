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

function auth_require_current_user(): array
{
    $user = auth_current_user();
    if ($user) return $user;

    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Sesion no valida']);
    exit;
}

function auth_action_me()
{
    $user = auth_current_user();
    $activeProfile = $user ? auth_active_profile((int)$user['id']) : null;

    echo json_encode([
        'success'        => true,
        'user'           => $user ? auth_public_user($user) : null,
        'active_profile' => $activeProfile ? auth_public_profile($activeProfile) : null,
    ]);
}

function auth_action_update_me()
{
    $user            = auth_require_current_user();
    $name            = trim($_POST['name']);
    $email           = trim($_POST['email']);
    $currentPassword = (string)$_POST['current_password'];
    $newPassword     = (string)$_POST['new_password'];
    $passwordConfirm = (string)$_POST['password_confirm'];

    if ($name === '' || $email === '') {
        echo json_encode(['success' => false, 'message' => 'Nombre y correo son obligatorios']);
        return;
    }
    if (mb_strlen($name) > 120 || mb_strlen($email) > 254) {
        echo json_encode(['success' => false, 'message' => 'Nombre o correo exceden la longitud permitida']);
        return;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'El correo no es valido']);
        return;
    }

    $st = auth_pdo()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
    $st->execute([$email, $user['id']]);
    if ($st->fetchColumn()) {
        echo json_encode(['success' => false, 'message' => 'Ese correo ya esta registrado']);
        return;
    }

    $passwordHash = $user['password_hash'];
    if ($newPassword !== '') {
        if (mb_strlen($newPassword) < 8) {
            echo json_encode(['success' => false, 'message' => 'La nueva contrasena debe tener al menos 8 caracteres']);
            return;
        }
        if ($newPassword !== $passwordConfirm) {
            echo json_encode(['success' => false, 'message' => 'Las contrasenas no coinciden']);
            return;
        }
        if ($passwordHash !== null && !password_verify($currentPassword, $passwordHash)) {
            echo json_encode(['success' => false, 'message' => 'La contrasena actual no es correcta']);
            return;
        }
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    }

    $st = auth_pdo()->prepare('UPDATE users SET name = ?, email = ?, password_hash = ?, updated_at = ? WHERE id = ?');
    $st->execute([$name, $email, $passwordHash, date('Y-m-d H:i:s'), $user['id']]);
    $updated = auth_find_by_id((int)$user['id']);

    echo json_encode([
        'success' => true,
        'message' => 'Cuenta actualizada correctamente',
        'user'    => auth_public_user($updated),
    ]);
}

function auth_action_profiles()
{
    $user = auth_require_current_user();
    $profiles = array_map('auth_public_profile', auth_list_profiles((int)$user['id']));

    echo json_encode(['success' => true, 'profiles' => $profiles]);
}

function auth_action_save_profile()
{
    $user        = auth_require_current_user();
    $id          = (int)$_POST['id'];
    $name        = trim($_POST['name']);
    $role        = trim($_POST['role']);
    $description = trim($_POST['description']);
    $color       = strtoupper(trim($_POST['color']));
    $userId      = (int)$user['id'];

    if ($name === '') {
        echo json_encode(['success' => false, 'message' => 'El nombre del perfil es obligatorio']);
        return;
    }
    if (mb_strlen($name) > 80 || mb_strlen($role) > 80 || mb_strlen($description) > 280) {
        echo json_encode(['success' => false, 'message' => 'Los datos del perfil exceden la longitud permitida']);
        return;
    }
    if (!preg_match('/^#[0-9A-F]{6}$/', $color)) $color = '#6366F1';

    $st = auth_pdo()->prepare('SELECT id FROM profiles WHERE user_id = ? AND name = ? AND id <> ?');
    $st->execute([$userId, $name, $id]);
    if ($st->fetchColumn()) {
        echo json_encode(['success' => false, 'message' => 'Ya existe un perfil con ese nombre']);
        return;
    }

    $now = date('Y-m-d H:i:s');
    if ($id > 0) {
        if (!auth_find_profile($id, $userId)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Perfil no encontrado']);
            return;
        }
        $st = auth_pdo()->prepare('UPDATE profiles SET name = ?, role = ?, description = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?');
        $st->execute([$name, $role, $description, $color, $now, $id, $userId]);
        $message = 'Perfil actualizado correctamente';
    } else {
        $st = auth_pdo()->prepare('SELECT COUNT(*) FROM profiles WHERE user_id = ?');
        $st->execute([$userId]);
        $count = (int)$st->fetchColumn();
        $st = auth_pdo()->prepare('INSERT INTO profiles (user_id, name, role, description, color, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $st->execute([$userId, $name, $role, $description, $color, $count === 0 ? 1 : 0, $now, $now]);
        $id = (int)auth_pdo()->lastInsertId();
        $message = 'Perfil creado correctamente';
    }

    echo json_encode([
        'success' => true,
        'message' => $message,
        'profile' => auth_public_profile(auth_find_profile($id, $userId)),
    ]);
}

function auth_action_activate_profile()
{
    $user   = auth_require_current_user();
    $id     = (int)$_POST['id'];
    $userId = (int)$user['id'];
    $profile = auth_find_profile($id, $userId);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Perfil no encontrado']);
        return;
    }

    $pdo = auth_pdo();
    $pdo->beginTransaction();
    $st = $pdo->prepare('UPDATE profiles SET is_active = 0, updated_at = ? WHERE user_id = ?');
    $st->execute([date('Y-m-d H:i:s'), $userId]);
    $st = $pdo->prepare('UPDATE profiles SET is_active = 1, updated_at = ? WHERE id = ? AND user_id = ?');
    $st->execute([date('Y-m-d H:i:s'), $id, $userId]);
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Perfil activo actualizado',
        'profile' => auth_public_profile(auth_find_profile($id, $userId)),
    ]);
}

function auth_action_delete_profile()
{
    $user   = auth_require_current_user();
    $id     = (int)$_POST['id'];
    $userId = (int)$user['id'];
    $profile = auth_find_profile($id, $userId);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Perfil no encontrado']);
        return;
    }

    $pdo = auth_pdo();
    $pdo->beginTransaction();
    $st = $pdo->prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?');
    $st->execute([$id, $userId]);

    if ((int)$profile['is_active'] === 1) {
        $st = $pdo->prepare('SELECT id FROM profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1');
        $st->execute([$userId]);
        $nextId = $st->fetchColumn();
        if ($nextId) {
            $st = $pdo->prepare('UPDATE profiles SET is_active = 1, updated_at = ? WHERE id = ? AND user_id = ?');
            $st->execute([date('Y-m-d H:i:s'), $nextId, $userId]);
        }
    }
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Perfil eliminado correctamente']);
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
    case 'update_me':
        auth_action_update_me();
        break;
    case 'profiles':
        auth_action_profiles();
        break;
    case 'save_profile':
        auth_action_save_profile();
        break;
    case 'activate_profile':
        auth_action_activate_profile();
        break;
    case 'delete_profile':
        auth_action_delete_profile();
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Accion no reconocida']);
}
