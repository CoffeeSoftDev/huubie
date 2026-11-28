<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Proveedores del Catálogo de insumos (supplier): se eligen al
    capturar una entrada por compra y como proveedor habitual del insumo.
    Son de toda la empresa. */
class ctrl extends coreCatalogo {

    // Columnas: Proveedor, Contacto, Teléfono, Correo, RFC, Estado.
    public function lsProveedores() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($s) {
            $id = (int) $s['id'];

            return [
                'id'        => $id,
                'Proveedor' => $this->cellTitle($s['name'], $s['note']),
                'Contacto'  => $s['contact_name'] ? h($s['contact_name']) : $this->dash(),
                'Teléfono'  => $s['phone'] ? h($s['phone']) : $this->dash(),
                'Correo'    => $s['email'] ? h($s['email']) : $this->dash(),
                'RFC'       => $s['rfc'] ? h($s['rfc']) : $this->dash(),
                'Estado'    => $this->activeCell($s['active']),
                'a'         => $this->rowActions('proveedores', $id, $s['active'])
            ];
        }, $this->qSupplierRows($this->companyId(), $this->activeFilter()));

        return $this->listed('proveedores', $row);
    }

    public function getProveedor() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $s = $this->qCatalogRow('supplier', $this->postId(), $this->companyId());

        return $s ? ['status' => 200, 'data' => $s] : $this->fail(404, 'Ese proveedor ya no existe.');
    }

    public function addProveedor() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->supplierInput(0);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('supplier', array_merge(array_keys($in), ['company_id', 'active']), array_merge(array_values($in), [$this->companyId(), 1])), 'addProveedor');

            return $this->ok('Proveedor agregado.');
        }, 'No se pudo guardar el proveedor.');
    }

    public function editProveedor() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('supplier', $id, $this->companyId())) return $this->fail(404, 'Ese proveedor ya no existe.');

        $in = $this->supplierInput($id);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('supplier', array_keys($in), array_merge(array_values($in), [$id])), 'editProveedor');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el proveedor.');
    }

    public function statusProveedor() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $s      = $this->qCatalogRow('supplier', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$s) return $this->fail(404, 'Ese proveedor ya no existe.');

        return $this->attempt(function () use ($s, $active) {
            $this->must($this->qCatalogUpdate('supplier', ['active'], [$active, (int) $s['id']]), 'statusProveedor');

            return $this->ok($active === 1 ? 'Proveedor activado.' : 'Proveedor dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el proveedor.');
    }

    private function supplierInput($exceptId) {
        $name = $this->requiredText('name', 'el nombre del proveedor', 160);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('supplier', 'name', $name, $this->companyId(), $exceptId)) return $this->fail(409, 'Ya hay un proveedor con ese nombre.');

        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $email = $this->post('email');
        $rfc   = strtoupper(preg_replace('/\s+/', '', $this->post('rfc')));

        if (strlen($phone) > 10) return $this->fail(400, 'El teléfono lleva máximo 10 dígitos.');
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->fail(400, 'Ese correo no es válido.');
        if ($rfc !== '' && !preg_match('/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/u', $rfc)) return $this->fail(400, 'Ese RFC no es válido (12 o 13 caracteres).');

        return [
            'name'         => $name,
            'contact_name' => $this->textOrNull('contact_name', 120),
            'phone'        => $phone ?: null,
            'email'        => $email ?: null,
            'rfc'          => $rfc ?: null,
            'note'         => $this->textOrNull('note', 255)
        ];
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
