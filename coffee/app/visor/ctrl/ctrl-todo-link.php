<?php
/* Generación de códigos de vinculación, DESDE el visor y con la sesión del visor.
 *
 * Es la mitad de la vinculación que exige estar autenticado aquí: solo el dueño
 * de la cuenta puede pedir un código para ella. El canje ocurre en el otro lado
 * (ctrl-todo-sync.php action=link), que es servidor a servidor y va por token.
 *
 * No lleva token a propósito: quien llama es el navegador del usuario, con su
 * cookie de sesión; pedir además un secreto de servidor no añadiría nada.
 */

require_once __DIR__ . '/../../ctrl/auth-session.php';
require_once __DIR__ . '/todo-link-store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function link_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

$userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
if ($userId <= 0) link_fail('Inicia sesion en el visor para vincular una aplicacion.', 401);

$action = $_POST['action'] ?? $_GET['action'] ?? 'create';

try {
    switch ($action) {

        case 'create': {
            $app  = trim((string) ($_POST['app'] ?? 'avatars'));
            $data = todo_link_generate($userId, $app);

            echo json_encode([
                'success'    => true,
                'code'       => $data['code'],
                'expires_at' => $data['expires_at'],
                'ttl'        => $data['ttl'],
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Los que siguen vivos, por si se generó uno y no se llegó a usar
        case 'active': {
            echo json_encode(['success' => true, 'codes' => todo_link_active($userId)], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'revoke': {
            $ok = todo_link_revoke($_POST['code'] ?? '', $userId);
            echo json_encode(['success' => $ok, 'message' => $ok ? 'Codigo revocado' : 'Ese codigo no es tuyo o ya no existe'], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            link_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    link_fail('Error al generar el codigo: ' . $e->getMessage(), 500);
}
