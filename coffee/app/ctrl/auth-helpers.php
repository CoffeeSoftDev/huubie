<?php
function coffee_auth_initials(string $name): string
{
    $parts = array_values(array_filter(preg_split('/\s+/', trim($name))));
    if (!$parts) return 'US';
    if (count($parts) === 1) return strtoupper(mb_substr($parts[0], 0, 2));
    return strtoupper(mb_substr($parts[0], 0, 1) . mb_substr(end($parts), 0, 1));
}

function auth_current_user(): ?array
{
    if (empty($_SESSION['user_id'])) return null;

    $u = auth_find_by_id((int)$_SESSION['user_id']);
    if (!$u) {
        $_SESSION = [];
        session_destroy();
        return null;
    }

    return $u;
}

function auth_public_user(array $u): array
{
    return [
        'id'         => (int)$u['id'],
        'name'       => $u['name'],
        'email'      => $u['email'],
        'avatar_url' => $u['avatar_url'],
        'initials'   => coffee_auth_initials($u['name']),
    ];
}
