<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Métodos de pago: cada método es de una empresa; company_id NULL es plantilla de Huubie.
class ctrl extends core {

    public function formOptions() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        return ['status' => 200, 'kinds' => $this->paymentKinds()];
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
                'Método'   => cellTitle($item['name'], $item['code']),
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
                'values' => ['name', 'code', 'kind', 'commission', 'sort', 'is_cash', 'is_visible', 'earns_points', 'company_id', 'active'],
                'data'   => [
                    $in['name'], $in['code'], $in['kind'], $in['commission'], $in['sort'],
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
                'values' => ['name', 'code', 'kind', 'commission', 'sort', 'is_cash', 'is_visible', 'earns_points', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [
                    $in['name'], $in['code'], $in['kind'], $in['commission'], $in['sort'],
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

        if ($name === '')                return $this->fail(400, 'Escribe el nombre del método de pago.');
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

    private function kindLabel($kind) {
        $kind = trim((string) $kind);

        if ($kind === '') return '<span class="cp-celda-sub">—</span>';

        $labels = array_column($this->paymentKinds(), 'valor', 'id');

        return h(isset($labels[$kind]) ? $labels[$kind] : $kind);
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
