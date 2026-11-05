<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../../../core/helpers/_CoffeeSoft.php';
require_once __DIR__ . '/../mdl/mdl-developer.php';

/*  Lo que comparten los ctrl de las secciones del modulo Developer (Accesos,
    Facturacion): catalogos de estados, helpers de botones y de validacion y los
    badges. Portado de inventory/tenant/ctrl/ctrl-tenant.php,
    que era un solo ctrl para todo el tenant. */

// Colores del acento del tema para badge(): van como variables CSS y no como
// hex para que sigan al tema elegido (ver assets/js/tailwind-theme.js).
const ACCENT_TEXT = 'var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))';
const ACCENT_BG   = 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))';

class core extends mdl {

    /* Valores de enum validos por entidad (whitelist). */
    protected $companyStatuses = ['pending', 'active', 'suspended', 'cancelled'];
    protected $subStatuses     = ['trial', 'active', 'past_due', 'cancelled', 'expired'];
    protected $billingCycles   = ['monthly', 'yearly', 'lifetime'];
    protected $modulesModes    = ['included', 'all', 'custom'];
    protected $paymentStatuses = ['paid', 'pending', 'failed', 'refunded'];
    protected $discountTypes   = ['percent', 'fixed'];

    // Los permisos se resuelven por roles.code: un rol de empresa con el codigo
    // root le daria acceso total a toda la plataforma a quien lo tenga.
    protected $reservedRoleCodes = ['root', 'dueno'];

    // La empresa con la que se trabaja: la de la sesion. root que entro a
    // Developer sin elegir empresa trabaja sobre la primera activa.
    protected function companyId() {
        $id = (int) ($_SESSION['company_id'] ?? 0);
        if ($id > 0) return $id;

        $first = $this->_Read("SELECT id FROM {$this->bd}companies WHERE status = 'active' ORDER BY id LIMIT 1");
        return empty($first) ? 0 : (int) $first[0]['id'];
    }

    /* ===== Helpers internos ===== */

    // Clase de los botones de accion en el estilo minimalista que ya usaba la
    // pestana Usuarios (borde + texto, sin relleno solido). Centraliza la cadena
    // que estaba repetida en ~19 sitios del archivo con dos lenguajes distintos
    // (btn-primary de Bootstrap y bg-slate-100 de Tailwind): variant 'neutral'
    // para editar/cambiar estado/activar/abrir factura, 'danger' para
    // desactivar/eliminar. $last quita el me-1 cuando es el ultimo boton de la fila.
    protected function actionBtnClass($variant, $last = false) {
        $base = $variant === 'danger'
            ? 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition'
            : 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition';
        return $last ? $base : $base . ' me-1';
    }

    // Acciones estándar editar + activar/desactivar para entidades del catálogo.
    // $toggleIsLast en false cuando la fila agrega otro boton despues del toggle
    // (ej. Tipos de permiso agrega Eliminar cuando el registro esta inactivo).
    protected function toggleActions($jsObj, $editFn, $toggleFn, $id, $isActive, $toggleIsLast = true) {
        $a = [];
        $a[] = [
            'class'   => $this->actionBtnClass('neutral', false),
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "{$jsObj}.{$editFn}({$id})"
        ];
        if ((int) $isActive === 1) {
            $a[] = [
                'class'   => $this->actionBtnClass('danger', $toggleIsLast),
                'html'    => '<i class="icon-toggle-on"></i>',
                'onclick' => "{$jsObj}.{$toggleFn}({$id}, 0)"
            ];
        } else {
            $a[] = [
                'class'   => $this->actionBtnClass('neutral', $toggleIsLast),
                'html'    => '<i class="icon-toggle-off"></i>',
                'onclick' => "{$jsObj}.{$toggleFn}({$id}, 1)"
            ];
        }
        return $a;
    }

    protected function paymentStatusIn($v) {
        return in_array($v, $this->paymentStatuses, true) ? $v : 'paid';
    }

    protected function companyStatusIn($v) {
        return in_array($v, $this->companyStatuses, true) ? $v : 'active';
    }

    protected function subStatusIn($v) {
        return in_array($v, $this->subStatuses, true) ? $v : 'active';
    }

    protected function intOrNull($v) {
        $v = trim((string) $v);
        return $v === '' ? null : (int) $v;
    }

    // Para selects OPCIONALES con placeholder "-- Selecciona --" (value="0"):
    // tanto '' como '0' significan "sin valor" -> NULL (no rompe la FK).
    protected function selectOrNull($v) {
        $v = trim((string) $v);
        return ($v === '' || $v === '0') ? null : (int) $v;
    }

    protected function dateOrNull($v) {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    // Precios opcionales: vacío -> NULL, si no el número con dos decimales.
    protected function moneyOrNull($v) {
        $v = trim((string) $v);
        return $v === '' ? null : round((float) $v, 2);
    }

    // Ids que el front manda como JSON en un hidden (los select múltiples: el
    // modal arma su envío con FormData y de un select múltiple solo quedaría el último).
    protected function postedIds($key) {
        $decoded = json_decode((string) ($_POST[$key] ?? ''), true);
        if (!is_array($decoded)) return [];

        $ids = [];
        foreach ($decoded as $v) {
            $id = (int) $v;
            if ($id > 0) $ids[] = $id;
        }
        return array_values(array_unique($ids));
    }
}

/* ===== Helpers de render (badges) ===== */

function renderActive($status) {
    switch ((int) $status) {
        case 1:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-emerald-50 text-emerald-700 ">Activo</span>';
        case 0:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-red-50 text-red-700 ">Inactivo</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-500 ">Desconocido</span>';
    }
}

function renderCompanyStatus($status) {
    switch ($status) {
        case 'active':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-emerald-50 text-emerald-700 ">Activa</span>';
        case 'pending':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-amber-50 text-amber-700 ">Pendiente</span>';
        case 'suspended':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-red-50 text-red-700 ">Suspendida</span>';
        case 'cancelled':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-red-50 text-red-700 ">Cancelada</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-500 ">—</span>';
    }
}

function renderSubStatus($status) {
    switch ($status) {
        case 'active':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-emerald-50 text-emerald-700 ">Activa</span>';
        case 'trial':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-sky-50 text-sky-700 ">Prueba</span>';
        case 'past_due':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-amber-50 text-amber-700 ">Vencida</span>';
        case 'cancelled':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-red-50 text-red-700 ">Cancelada</span>';
        case 'expired':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-600 ">Expirada</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-500 ">—</span>';
    }
}

function renderBillingCycle($cycle) {
    switch ($cycle) {
        case 'monthly':  return 'Mensual';
        case 'yearly':   return 'Anual';
        case 'lifetime': return 'De por vida';
        default:         return $cycle ?: '-';
    }
}

function renderPaymentStatus($status) {
    switch ($status) {
        case 'paid':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-emerald-50 text-emerald-700 ">Pagado</span>';
        case 'pending':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-amber-50 text-amber-700 ">Pendiente</span>';
        case 'failed':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-red-50 text-red-700 ">Fallido</span>';
        case 'refunded':
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-600 ">Reembolsado</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-500 ">—</span>';
    }
}

function avatarInitials($name) {
    $name = trim((string) $name);
    if ($name === '') return '?';

    $parts    = preg_split('/\s+/', $name);
    $initials = mb_strtoupper(mb_substr($parts[0], 0, 1));
    if (count($parts) > 1) {
        $initials .= mb_strtoupper(mb_substr($parts[count($parts) - 1], 0, 1));
    } elseif (mb_strlen($parts[0]) > 1) {
        $initials .= mb_strtoupper(mb_substr($parts[0], 1, 1));
    }
    return $initials;
}

function renderAvatar($name) {
    $name = trim((string) $name);
    return '<div class="flex items-center gap-2">'
        . '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold shrink-0">' . htmlspecialchars(avatarInitials($name)) . '</span>'
        . '<span>' . htmlspecialchars($name) . '</span>'
        . '</div>';
}

// Celda de la tabla de Sucursales: avatar con iniciales, nombre y el correo debajo.
function renderUserCell($name, $email) {
    return '<div class="flex items-center gap-2.5">'
        . '<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-[10.5px] font-semibold shrink-0">' . htmlspecialchars(avatarInitials($name)) . '</span>'
        . '<div class="min-w-0">'
        . '<p class="font-semibold text-gray-900 truncate mb-0">' . htmlspecialchars($name) . '</p>'
        . '<p class="text-[11px] text-gray-500 truncate mb-0">' . htmlspecialchars($email ?: '—') . '</p>'
        . '</div>'
        . '</div>';
}

// users.status es un enum de texto ('active'/'inactive'), no el 1/0 que usa
// renderActive() para el resto de los catalogos de este modulo.
function renderUserStatus($status) {
    return $status === 'active'
        ? badge('Activo', '#16A34A', 100, '#DCFCE7')
        : badge('Inactivo', '#9D3434', 100, '#F6E4E4');
}

function renderDiscount($type, $value) {
    $value = (float) $value;
    if ($type === 'percent') {
        return rtrim(rtrim(number_format($value, 2), '0'), '.') . '%';
    }
    return '$' . number_format($value, 2);
}
