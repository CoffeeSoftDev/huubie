<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Métodos de pago: cada método es de una empresa; company_id NULL es plantilla de Huubie.
class ctrl extends core {

    public function formOptions() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $icons = [];

        foreach ($this->paymentIcons() as $name => $icon) {
            $icons[] = ['id' => $name, 'valor' => $icon[0], 'svg' => $this->iconSvg($name, 22)];
        }

        return [
            'status'       => 200,
            'kinds'        => $this->paymentKinds(),
            'icons'        => $icons,
            'kindIcons'    => $this->kindIcons(),
            'defaultColor' => self::DEFAULT_COLOR
        ];
    }

    public function lsPaymentMethods() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $company = $this->companyId();
        $row     = [];

        foreach ($this->qListPaymentMethods($company, $this->activeFilter()) as $item) {
            $id = (int) $item['id'];

            $row[] = [
                'id'       => $id,
                'Método'   => $this->methodCell($item),
                'Tipo'     => $this->kindLabel($item['kind']),
                'Comisión' => (float) $item['commission'] . '%',
                'Orden'    => (int) $item['sort'],
                'Efectivo' => yesNo($item['is_cash']),
                'Visible'  => yesNo($item['is_visible']),
                'Puntos'   => yesNo($item['earns_points']),
                'Origen'   => originBadge($item['company_id']),
                'Estado'   => renderActive($item['active']),
                'a'        => $this->rowActions('paymentMethods', $id, $item['active'], $this->isTemplate($item))
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountPaymentMethods($company)];
    }

    public function getPaymentMethod() {
        $data = $this->qGetPaymentMethod($this->postId(), $this->companyId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'El método de pago no existe.');
    }

    public function addPaymentMethod() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $in = $this->paymentMethodInput();
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreatePaymentMethod([
                'values' => ['name', 'code', 'kind', 'icon', 'color', 'commission', 'sort', 'is_cash', 'is_visible', 'earns_points', 'company_id', 'active'],
                'data'   => [
                    $in['name'], $in['code'], $in['kind'], $in['icon'], $in['color'], $in['commission'], $in['sort'],
                    $in['is_cash'], $in['is_visible'], $in['earns_points'], $this->companyId(), 1
                ]
            ]), 'addPaymentMethod');

            return $this->ok('Método de pago creado.');
        }, 'No se pudo guardar el método de pago.');
    }

    public function editPaymentMethod() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id   = $this->postId();
        $fail = $this->changeBlocked($id);
        if ($fail) return $fail;

        $in = $this->paymentMethodInput();
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in, $id);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdatePaymentMethod([
                'values' => ['name', 'code', 'kind', 'icon', 'color', 'commission', 'sort', 'is_cash', 'is_visible', 'earns_points', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [
                    $in['name'], $in['code'], $in['kind'], $in['icon'], $in['color'], $in['commission'], $in['sort'],
                    $in['is_cash'], $in['is_visible'], $in['earns_points'], $id
                ]
            ]), 'editPaymentMethod');

            return $this->ok('Método de pago actualizado.');
        }, 'No se pudo guardar el método de pago.');
    }

    public function statusPaymentMethod() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id   = $this->postId();
        $fail = $this->changeBlocked($id);
        if ($fail) return $fail;

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdatePaymentMethod([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusPaymentMethod');

            return $this->ok($active === 1 ? 'Método de pago activado.' : 'Método de pago desactivado.');
        }, 'No se pudo cambiar el estado del método de pago.');
    }

    // -- Auxiliares --

    // Devuelve los campos del método o una respuesta de error (trae 'status').
    private function paymentMethodInput() {
        $name       = $this->nameInput();
        $code       = $this->code('code');
        $kind       = $this->textOrNull('kind');
        $commission = $this->percent('commission', 0);
        $sort       = $this->post('sort') === '' ? 0 : $this->intOrNull('sort');
        $icon       = $this->textOrNull('icon');
        $color      = $this->textOrNull('color');

        if ($name === '')                return $this->fail(400, 'Escribe el nombre del método de pago.');
        if ($icon !== null && !isset($this->paymentIcons()[$icon])) {
            return $this->fail(400, 'El icono elegido no es válido.');
        }
        if ($color !== null && !preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
            return $this->fail(400, 'El color debe ir como #RRGGBB, por ejemplo #16A34A.');
        }
        if ($this->tooLong($name, 50))   return $this->fail(400, 'El nombre admite hasta 50 caracteres.');
        if ($this->tooLong($code, 20))   return $this->fail(400, 'La clave admite hasta 20 caracteres.');
        if ($kind !== null && !in_array($kind, array_column($this->paymentKinds(), 'id'), true)) {
            return $this->fail(400, 'El tipo de pago no es válido.');
        }
        if ($commission === null)        return $this->fail(400, 'La comisión debe ser un número de 0 a 100.');
        if ($sort === null || $sort < 0) return $this->fail(400, 'El orden debe ser un número entero de 0 en adelante.');

        return [
            'name'         => $name,
            'code'         => $code,
            'kind'         => $kind,
            'icon'         => $icon,
            'color'        => $color === null ? null : strtoupper($color),
            'commission'   => $commission,
            'sort'         => $sort,
            'is_cash'      => $this->flag('is_cash'),
            'is_visible'   => $this->flag('is_visible'),
            'earns_points' => $this->flag('earns_points')
        ];
    }

    // Respuesta 409 si el nombre o la clave ya están ocupados; null si están libres.
    private function duplicateError($in, $exceptId = 0) {
        $company = $this->companyId();

        $dup = $this->qFindPaymentMethodByName($company, $in['name'], $exceptId);

        if ($dup) {
            return $this->isTemplate($dup)
                ? $this->fail(409, 'Ya existe una plantilla de Huubie con ese nombre.')
                : $this->duplicated($dup, 'un método de pago con ese nombre');
        }

        if ($in['code'] === null) return null;

        $dup = $this->qFindPaymentMethodByCode($company, $in['code'], $exceptId);

        if (!$dup) return null;

        return $this->isTemplate($dup)
            ? $this->fail(409, 'Ya existe una plantilla de Huubie con esa clave.')
            : $this->duplicated($dup, 'un método de pago con esa clave');
    }

    // Respuesta de error si el método no existe en la empresa o es plantilla; null si se puede cambiar.
    private function changeBlocked($id) {
        $item = $this->qGetPaymentMethod($id, $this->companyId());

        if (!$item) return $this->fail(404, 'El método de pago no existe.');

        return $this->isTemplate($item) ? $this->lockedTemplate() : null;
    }

    // -- Icono y color --

    // Gris de los métodos sin color propio.
    const DEFAULT_COLOR = '#64748B';

    /*  Iconos que se pueden elegir: nombre Lucide => [etiqueta, trazos SVG].
        Lista fija y no las 1,800 de Lucide: el trazo se dibuja aquí, en el
        servidor, para que la tabla lo muestre en cualquier página de DataTables. */
    private function paymentIcons() {
        return [
            'banknote'         => ['Billete', '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'],
            'coins'            => ['Monedas', '<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/>'],
            'credit-card'      => ['Tarjeta', '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>'],
            'arrow-left-right' => ['Transferencia', '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'],
            'landmark'         => ['Banco', '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>'],
            'smartphone'       => ['Celular', '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'],
            'qr-code'          => ['Código QR', '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>'],
            'wallet'           => ['Monedero', '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'],
            'ticket'           => ['Vale', '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'],
            'gift'             => ['Tarjeta de regalo', '<path d="M12 7v14"/><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/><rect x="3" y="7" width="18" height="4" rx="1"/>'],
            'star'             => ['Puntos', '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'],
            'hand-coins'       => ['Pago en mano', '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>']
        ];
    }

    private function iconSvg($name, $size = 18) {
        $icons = $this->paymentIcons();
        $paths = isset($icons[$name]) ? $icons[$name][1] : $icons['wallet'][1];

        return '<svg xmlns="http://www.w3.org/2000/svg" width="' . (int) $size . '" height="' . (int) $size . '" viewBox="0 0 24 24" fill="none"'
             . ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths . '</svg>';
    }

    // Icono de cada tipo de pago, para el método que no eligió uno.
    private function kindIcons() {
        return ['efectivo' => 'banknote', 'tarjeta' => 'credit-card', 'transferencia' => 'arrow-left-right', 'vales' => 'ticket', 'puntos' => 'star'];
    }

    // Sin icono elegido: el que corresponde a su tipo.
    private function iconFor($item) {
        $icon = trim((string) $item['icon']);

        if ($icon !== '' && isset($this->paymentIcons()[$icon])) return $icon;

        $byKind = $this->kindIcons();
        $kind   = trim((string) $item['kind']);

        return isset($byKind[$kind]) ? $byKind[$kind] : 'wallet';
    }

    // Distintivo de color con el icono, y al lado nombre y clave.
    private function methodCell($item) {
        $color = preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $item['color']) ? strtoupper($item['color']) : self::DEFAULT_COLOR;

        return '<div class="flex items-center gap-3">'
            . '<span class="cp-pm-badge" style="--pm-color:' . $color . '">' . $this->iconSvg($this->iconFor($item)) . '</span>'
            . '<div class="min-w-0">' . cellTitle($item['name'], $item['code']) . '</div>'
            . '</div>';
    }

    private function kindLabel($kind) {
        $kind = trim((string) $kind);

        if ($kind === '') return '<span class="cp-celda-sub">—</span>';

        $labels = array_column($this->paymentKinds(), 'valor', 'id');

        return h(isset($labels[$kind]) ? $labels[$kind] : $kind);
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
