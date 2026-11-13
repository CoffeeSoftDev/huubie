<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › Clientes (Etapa 6a): el directorio de clientes de la sucursal.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-clientes. Ver, agregar y editar: Dueño, Cajera y
        Supervisor. Activar o desactivar pide 'delete' (hoy solo Dueño).
      - No se borra: se desactiva. Un cliente inactivo deja de salir en la
        captura; sus pedidos siguen igual.
      - El telefono es la llave practica: 10 digitos y unico entre los activos
        de la sucursal.
      - Pedidos, vendido y por cobrar cuentan pedidos de cualquier sucursal;
        desde el historial solo se abre el detalle de los de esta.
      - La BD no tiene bitacora de clientes: una edicion no deja rastro. */
class ctrl extends core {

    const CLIENTS     = 'pos-clientes';
    const HISTORY_MAX = 200;

    // Ordenes de la lista: nombre, mas pedidos, mas vendido, mayor saldo, ultimo pedido.
    const SORTS = ['name', 'orders', 'sold', 'due', 'recent'];

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'  => 200,
            'scope'   => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions' => $this->actions(),
            'clients' => Permission::actions(self::CLIENTS),
            'tickets' => Permission::actions(self::TICKETS),
            'today'   => date('Y-m-d'),
            'turn'    => $this->turnBrief(),
            'day'     => $this->dayBrief()
        ];
    }

    // -- Lista --

    public function lsCustomers() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $status = $this->post('status', '1');
        $active = $status === 'all' ? null : ($status === '0' ? 0 : 1);
        $sort   = in_array($this->post('sort'), self::SORTS, true) ? $this->post('sort') : 'name';

        return $this->attempt(function () use ($active, $sort) {
            $actions = Permission::actions(self::CLIENTS);
            $rows    = [];

            foreach ($this->qCustomerList($this->branchId(), $active, $sort) as $customer) {
                $rows[] = $this->customerRow($customer, $actions);
            }

            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de clientes.');
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function customerRow($c, array $actions) {
        $id     = (int) $c['id'];
        $active = (int) $c['active'] === 1;
        $orders = (int) $c['orders'];

        return [
            'id'            => $id,
            'Cliente'       => $this->cellCustomer($c['name'], $c['phone'], $c['email']),
            'Pedidos'       => $orders > 0 ? '<span class="font-semibold text-gray-800">' . $orders . '</span>' : $this->cellZero(),
            'Último pedido' => $c['last_order'] ? '<span class="text-gray-600 whitespace-nowrap">' . shortDate($c['last_order']) . '</span>' : $this->cellZero(),
            'Vendido'       => $this->cellMoney($c['sold'], 'font-semibold text-gray-800'),
            'Por cobrar'    => $this->cellMoney($c['due'], 'font-bold text-red-600'),
            'A favor'       => $this->cellMoney($c['credit'], 'font-semibold text-sky-700'),
            'Estado'        => $this->activePill($active),
            'a'             => $this->rowActions($id, $active, $actions)
        ];
    }

    // -- Un cliente --

    public function getCustomer() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $customer = $this->qBranchCustomer($this->postId(), $this->branchId());

            if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

            return ['status' => 200, 'row' => $this->customerBrief($customer)];
        }, 'No se pudo abrir el cliente.');
    }

    public function addCustomer() {
        $fail = $this->needClients('create') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $phone, $email) = $this->customerFields();
        if ($fail) return $fail;

        return $this->attempt(function () use ($name, $phone, $email) {
            return $this->transaction(function () use ($name, $phone, $email) {
                $taken = $this->qCustomerPhoneTaken($this->branchId(), $phone, 0);

                if ($taken) return $this->fail(409, $this->takenText($taken));

                $this->must($this->qCreateCustomer([
                    'values' => ['name', 'phone', 'email', 'branch_id', 'active'],
                    'data'   => [$name, $phone, $email, $this->branchId(), 1]
                ]), 'addCustomer');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCustomer: sin id');

                return $this->ok('Cliente agregado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    public function editCustomer() {
        $fail = $this->needClients('update') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $phone, $email) = $this->customerFields();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $name, $phone, $email) {
            return $this->transaction(function () use ($id, $name, $phone, $email) {
                $customer = $this->qBranchCustomer($id, $this->branchId());

                if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

                // Un inactivo puede repetir telefono: el choque se revisa al reactivarlo.
                if ((int) $customer['active'] === 1) {
                    $taken = $this->qCustomerPhoneTaken($this->branchId(), $phone, $id);

                    if ($taken) return $this->fail(409, $this->takenText($taken));
                }

                $this->must($this->qUpdateCustomer([
                    'values' => ['name', 'phone', 'email', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$name, $phone, $email, $id]
                ]), 'editCustomer');

                return $this->ok('Cliente actualizado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    // Activa o desactiva. No borra: los pedidos del cliente se quedan.
    public function statusCustomer() {
        $fail = $this->needClients('delete') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($id, $active) {
            return $this->transaction(function () use ($id, $active) {
                $customer = $this->qBranchCustomer($id, $this->branchId());

                if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

                if ((int) $customer['active'] === $active) {
                    return $this->ok($active === 1 ? 'El cliente ya estaba activo.' : 'El cliente ya estaba inactivo.', ['id' => $id]);
                }

                if ($active === 1) {
                    $phone = preg_replace('/\D/', '', $customer['phone']);
                    $taken = $phone !== '' ? $this->qCustomerPhoneTaken($this->branchId(), $phone, $id) : null;

                    if ($taken) return $this->fail(409, $this->takenText($taken) . ' Cambia el teléfono antes de reactivarlo.');
                }

                $this->must($this->qUpdateCustomer([
                    'values' => ['active', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$active, $id]
                ]), 'statusCustomer');

                return $this->ok($active === 1 ? 'Cliente reactivado.' : 'Cliente desactivado.', ['id' => $id]);
            });
        }, 'No se pudo cambiar el estado del cliente.');
    }

    // -- Historial --

    public function lsHistory() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $branchId = $this->branchId();
            $customer = $this->qBranchCustomer($this->postId(), $branchId);

            if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

            $canOpen = Permission::can(self::SECTION, 'show');
            $orders  = [];
            $summary = ['orders' => 0, 'sold' => 0.0, 'paid' => 0.0, 'due' => 0.0, 'cancelled' => 0, 'quotes' => 0];

            // Se pide uno de mas para saber si la lista quedo cortada.
            $found = $this->qCustomerHistory((int) $customer['id'], self::HISTORY_MAX + 1);
            $more  = count($found) > self::HISTORY_MAX;

            if ($more) array_pop($found);

            foreach ($found as $o) {
                $statusId = (int) $o['sale_status_id'];
                $total    = (float) $o['total'];
                $paid     = (float) $o['paid'];
                $alive    = in_array($statusId, [self::PENDING, self::PAID], true);
                $due      = $statusId === self::PENDING ? max(round($total - $paid, 2), 0) : 0;

                if ($alive) {
                    $summary['orders']++;
                    $summary['sold'] += $total;
                    $summary['paid'] += $paid;
                    $summary['due']  += $due;
                }

                if ($statusId === self::CANCELLED) $summary['cancelled']++;
                if ($statusId === self::QUOTE)     $summary['quotes']++;

                $orders[] = [
                    'id'          => (int) $o['id'],
                    'folio'       => 'P' . ($o['folio'] !== null && $o['folio'] !== '' ? $o['folio'] : $o['id']),
                    'created'     => dmy($o['created_at']),
                    'delivery'    => dmy($o['delivery_date']),
                    'status'      => $this->statusPill($statusId, $o['status']),
                    'total'       => money($total),
                    'paid'        => money($paid),
                    'due'         => $due > 0 ? money($due) : '',
                    'branch'      => $o['branch'],
                    'same_branch' => (int) $o['branch_id'] === $branchId,
                    'can_open'    => $canOpen && (int) $o['branch_id'] === $branchId
                ];
            }

            return [
                'status'   => 200,
                'customer' => $this->customerBrief($customer),
                'summary'  => [
                    'orders'    => $summary['orders'],
                    'sold'      => money($summary['sold']),
                    'paid'      => money($summary['paid']),
                    'due'       => money($summary['due']),
                    'has_due'   => $summary['due'] > 0.004,
                    'cancelled' => $summary['cancelled'],
                    'quotes'    => $summary['quotes']
                ],
                'row'      => $orders,
                'more'     => $more,
                'max'      => self::HISTORY_MAX
            ];
        }, 'No se pudo cargar el historial del cliente.');
    }

    // -- Complements --

    private function needClients($action) {
        if (Permission::can(self::CLIENTS, $action)) return null;

        $what = [
            'show'   => 'ver clientes',
            'create' => 'agregar clientes',
            'update' => 'editar clientes',
            'delete' => 'activar o desactivar clientes'
        ];

        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // [respuesta de error | null, nombre, telefono, correo] ya limpios.
    private function customerFields() {
        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $email = $this->post('email');

        if ($name === '')               return [$this->fail(422, 'Escribe el nombre del cliente.'), '', '', null];
        if ($this->tooLong($name, 120)) return [$this->fail(422, 'El nombre admite hasta 120 caracteres.'), '', '', null];
        if (strlen($phone) !== 10)      return [$this->fail(422, 'El teléfono debe tener 10 dígitos.'), '', '', null];

        if ($email !== '') {
            if ($this->tooLong($email, 120))                 return [$this->fail(422, 'El correo admite hasta 120 caracteres.'), '', '', null];
            if (!filter_var($email, FILTER_VALIDATE_EMAIL))  return [$this->fail(422, 'El correo no tiene un formato válido.'), '', '', null];
        }

        return [null, $name, $phone, $email === '' ? null : $email];
    }

    private function takenText($taken) {
        $label = trim((string) $taken['name']) !== '' ? trim($taken['name']) : 'otro cliente';

        return "Ese teléfono ya es de {$label}.";
    }

    private function customerBrief($c) {
        return [
            'id'     => (int) $c['id'],
            'name'   => (string) $c['name'],
            'phone'  => (string) $c['phone'],
            'email'  => (string) $c['email'],
            'active' => (int) $c['active'],
            'since'  => dmy($c['created_at'])
        ];
    }

    // -- Celdas --

    private function cellCustomer($name, $phone, $email) {
        $sub = array_filter([trim((string) $phone), trim((string) $email)], 'strlen');

        $html = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h(trim((string) $name) !== '' ? $name : 'Sin nombre') . '</span></div>';

        if (!empty($sub)) $html .= '<div class="ord-sub">' . h(implode(' · ', $sub)) . '</div>';

        return $html;
    }

    // Monto en cero: un guion en lugar de $0.00.
    private function cellZero() {
        return '<span class="text-gray-400">-</span>';
    }

    private function cellMoney($amount, $tone) {
        if (round((float) $amount, 2) <= 0) return $this->cellZero();

        return '<span class="' . $tone . ' whitespace-nowrap">' . money($amount) . '</span>';
    }

    private function activePill($active) {
        return $active
             ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Activo</span>'
             : '<span class="ord-pill bg-slate-100 text-slate-600">Inactivo</span>';
    }

    // Mismos tonos que la lista de pedidos.
    private function statusPill($statusId, $name) {
        $tones = [
            self::QUOTE     => 'bg-[#EAF0FA] text-[#2A55A3]',
            self::PENDING   => 'bg-amber-50 text-amber-700',
            self::PAID      => 'bg-emerald-50 text-emerald-700',
            self::CANCELLED => 'bg-red-50 text-red-700'
        ];

        $tone = isset($tones[$statusId]) ? $tones[$statusId] : 'bg-slate-100 text-slate-600';

        return '<span class="ord-pill ' . $tone . '">' . h($name !== '' ? $name : 'Sin estado') . '</span>';
    }

    // -- Acciones de la fila --

    private function actionBtnClass($variant, $last = false) {
        $base = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tone = $variant === 'danger'
              ? 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900';

        return $base . $tone . ($last ? '' : ' me-1');
    }

    // aria-label y no title: en este framework title dispara un popover.
    private function rowActions($id, $active, array $actions) {
        $buttons = [[
            'variant'    => 'neutral',
            'html'       => '<i data-lucide="history" class="w-4 h-4"></i>',
            'aria-label' => 'Historial de pedidos',
            'onclick'    => "customers.history({$id})"
        ]];

        if (in_array('update', $actions, true)) {
            $buttons[] = [
                'variant'    => 'neutral',
                'html'       => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                'aria-label' => 'Editar',
                'onclick'    => "customers.edit({$id})"
            ];
        }

        if (in_array('delete', $actions, true)) {
            $buttons[] = [
                'variant'    => $active ? 'danger' : 'neutral',
                'html'       => '<i data-lucide="' . ($active ? 'toggle-right' : 'toggle-left') . '" class="w-4 h-4"></i>',
                'aria-label' => $active ? 'Desactivar' : 'Activar',
                'onclick'    => "customers.status({$id}, " . ($active ? 0 : 1) . ')'
            ];
        }

        $last = count($buttons) - 1;
        $row  = [];

        foreach ($buttons as $i => $button) {
            $row[] = [
                'class'      => $this->actionBtnClass($button['variant'], $i === $last),
                'html'       => $button['html'],
                'aria-label' => $button['aria-label'],
                'onclick'    => $button['onclick']
            ];
        }

        return $row;
    }
}

Permission::dispatch(new ctrl(), ctrl::CLIENTS);
