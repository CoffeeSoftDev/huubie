<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Descuentos: motivos de descuento por empresa; company_id NULL es plantilla de Huubie.
class ctrl extends core {

    public function lsDiscounts() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $company = $this->companyId();
        $row     = [];

        foreach ($this->qListDiscounts($company, $this->activeFilter()) as $item) {
            $id = (int) $item['id'];

            $row[] = [
                'id'           => $id,
                'Motivo'       => cellTitle($item['name'], $item['code']),
                'Tope'         => $this->percentCell($item['max_percent']),
                'Autorización' => yesNo($item['requires_authorization']),
                'Origen'       => originBadge($item['company_id']),
                'Estado'       => renderActive($item['active']),
                'a'            => $this->rowActions('discounts', $id, $item['active'], $this->isTemplate($item))
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountDiscounts($company)];
    }

    public function getDiscount() {
        $data = $this->qGetDiscount($this->postId(), $this->companyId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'El descuento no existe.');
    }

    public function addDiscount() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $in = $this->discountInput();
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateDiscount([
                'values' => ['code', 'name', 'max_percent', 'requires_authorization', 'company_id', 'active'],
                'data'   => [$in['code'], $in['name'], $in['max_percent'], $in['requires_authorization'], $this->companyId(), 1]
            ]), 'addDiscount');

            return $this->ok('Descuento creado.');
        }, 'No se pudo guardar el descuento.');
    }

    public function editDiscount() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id   = $this->postId();
        $fail = $this->changeBlocked($id);
        if ($fail) return $fail;

        $in = $this->discountInput();
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in, $id);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateDiscount([
                'values' => ['code', 'name', 'max_percent', 'requires_authorization', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['code'], $in['name'], $in['max_percent'], $in['requires_authorization'], $id]
            ]), 'editDiscount');

            return $this->ok('Descuento actualizado.');
        }, 'No se pudo guardar el descuento.');
    }

    public function statusDiscount() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id   = $this->postId();
        $fail = $this->changeBlocked($id);
        if ($fail) return $fail;

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateDiscount([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusDiscount');

            return $this->ok($active === 1 ? 'Descuento activado.' : 'Descuento desactivado.');
        }, 'No se pudo cambiar el estado del descuento.');
    }

    // -- Auxiliares --

    // Devuelve los campos del descuento o una respuesta de error (trae 'status').
    private function discountInput() {
        $name    = $this->nameInput();
        $code    = $this->code('code');
        $percent = $this->percent('max_percent', 0);

        if ($name === '')              return $this->fail(400, 'Escribe el motivo del descuento.');
        if ($this->tooLong($name, 80)) return $this->fail(400, 'El motivo admite hasta 80 caracteres.');
        if ($this->tooLong($code, 20)) return $this->fail(400, 'La clave admite hasta 20 caracteres.');
        if ($percent === null)         return $this->fail(400, 'El tope debe ser un número de 0 a 100.');

        return [
            'name'                   => $name,
            'code'                   => $code,
            'max_percent'            => $percent,
            'requires_authorization' => $this->flag('requires_authorization')
        ];
    }

    // Respuesta 409 si el nombre o la clave ya están ocupados; null si están libres.
    private function duplicateError($in, $exceptId = 0) {
        $company = $this->companyId();

        $dup = $this->qFindDiscountByName($company, $in['name'], $exceptId);

        if ($dup) {
            return $this->isTemplate($dup)
                ? $this->fail(409, 'Ya existe una plantilla de Huubie con ese nombre.')
                : $this->duplicated($dup, 'un descuento con ese nombre');
        }

        if ($in['code'] === null) return null;

        $dup = $this->qFindDiscountByCode($company, $in['code'], $exceptId);

        if (!$dup) return null;

        return $this->isTemplate($dup)
            ? $this->fail(409, 'Ya existe una plantilla de Huubie con esa clave.')
            : $this->duplicated($dup, 'un descuento con esa clave');
    }

    // Respuesta de error si el descuento no existe en la empresa o es plantilla; null si se puede cambiar.
    private function changeBlocked($id) {
        $item = $this->qGetDiscount($id, $this->companyId());

        if (!$item) return $this->fail(404, 'El descuento no existe.');

        return $this->isTemplate($item) ? $this->lockedTemplate() : null;
    }

    // Hasta 2 decimales, sin ceros de relleno: 12.50 -> 12.5%; 20.00 -> 20%.
    private function percentCell($value) {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ','), '0'), '.') . '%';
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
