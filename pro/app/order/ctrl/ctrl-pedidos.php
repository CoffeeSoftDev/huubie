<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › lista, detalle y captura (Etapas 1 y 2).

    Reglas que no se ven en el codigo de un vistazo:
      - Buscar "1557", "P1557" o "P1557-04" encuentra el pedido 1557.
      - Con busqueda se ignoran el periodo y el estado; el tipo se respeta.
      - Saldo = total - pagado (sale.total ya es neto).
      - Punto verde = el pedido es del turno abierto de la sucursal.

    Captura:
      - Un pedido nuevo nace como Cotizacion y exige el turno de HOY abierto.
        Capturar no mueve dinero: el estado lo cambia el cobro (ctrl-cobro).
      - Cancelar con abonos deja lo pagado como saldo a favor del cliente
        (customer.wallet): no hay devolucion.
      - Nombre y precio de un producto del catalogo, y precio de cada opcion del
        pastel, salen de la base: lo que mande el navegador no cuenta.
      - Una linea ya guardada conserva su producto y su precio.
      - Editar y cancelar validan DESPUES de bloquear el pedido (FOR UPDATE).
      - Cada cambio deja su renglon en history_log con quien lo hizo. */
class ctrl extends core {

    const MAX_LINES  = 100;
    const MAX_PHOTOS = 10;
    const IMAGE_MAX  = 5242880;

    // Tipo de getimagesize() -> extension con la que se guarda.
    private $imageTypes = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'   => 200,
            'scope'    => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions'  => $this->actions(),
            'statuses' => $scope['company_id'] > 0 ? $this->qStatuses($scope['company_id']) : [],
            'today'    => date('Y-m-d'),
            'turn'     => $this->turnBrief(),
            'day'      => $this->dayBrief()
        ];
    }

    // -- Lista --

    public function lsOrders() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $filters = $this->listFilters();
            $turn    = $this->qOpenTurn($this->branchId());
            $turnId  = $turn ? (int) $turn['id'] : 0;
            $actions = $this->actions();

            $rows = [];

            foreach ($this->qListOrders($filters) as $order) {
                $rows[] = $this->orderRow($order, $turnId, $actions);
            }

            $answer = [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'mode'   => $filters['search'] !== null ? 'search' : 'range',
                'branch' => $this->scope()['branch']
            ];

            if ($filters['search'] !== null) {
                $id = $filters['search']['id'];

                $answer['total'] = $this->qCountOrders($filters);
                $answer['exact'] = $id > 0 && !empty($rows) && (int) $rows[0]['id'] === $id;
            }

            return $answer;
        }, 'No se pudo cargar la lista de pedidos.');
    }

    // Filtros del POST, ya limpios.
    private function listFilters() {
        $fi = $this->postDate('fi', date('Y-m-01'));
        $ff = $this->postDate('ff', date('Y-m-t'));

        if ($fi > $ff) list($fi, $ff) = [$ff, $fi];

        $type = $this->post('order_type');

        return [
            'branch_id'  => $this->branchId(),
            'date_type'  => $this->post('date_type') === 'delivery' ? 'delivery' : 'created',
            'fi'         => $fi,
            'ff'         => $ff,
            'status'     => $this->selectOrNull('status'),
            'order_type' => in_array($type, ['custom', 'normal'], true) ? $type : '',
            'search'     => $this->searchTerms($this->post('q'))
        ];
    }

    /*  null = sin busqueda. Dos letras minimo, salvo que sea un folio.
          "P1557" / "P1557-04"  solo folio.
          "1557"                folio, nombre o telefono (el folio exacto sale primero).
          "Ana"                 nombre o telefono (si tiene 3 digitos o mas). */
    private function searchTerms($q) {
        $q = mb_substr(trim($q), 0, 60, 'UTF-8');

        if ($q === '') return null;

        if (preg_match('/^P(\d+)(?:-\d+)?$/i', $q, $m)) {
            return ['id' => (int) $m[1], 'like' => null, 'phone' => null];
        }

        $id = preg_match('/^(\d+)(?:-\d+)?$/', $q, $m) ? (int) $m[1] : 0;

        if ($id === 0 && mb_strlen($q, 'UTF-8') < 2) return null;

        $digits = preg_replace('/\D/', '', $q);

        return [
            'id'    => $id,
            'like'  => '%' . addcslashes($q, '%_\\') . '%',
            'phone' => strlen($digits) >= 3 ? '%' . $digits . '%' : null
        ];
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function orderRow($o, $turnId, array $actions) {
        $id        = (int) $o['id'];
        $statusId  = (int) $o['sale_status_id'];
        $cancelled = $statusId === self::CANCELLED;
        $custom    = (int) $o['is_custom'] === 1;
        $inTurn    = $turnId > 0 && (int) $o['turn_id'] === $turnId;

        $menu = [['icon' => 'icon-eye', 'text' => 'Ver', 'onclick' => "orderDetail.show({$id})"]];

        if (in_array('update', $actions, true) && $this->editBlock($o) === '') {
            $menu[] = ['icon' => 'icon-pencil', 'text' => 'Editar', 'onclick' => "orderForm.edit({$id})"];
        }

        if (in_array('create', $actions, true) && $this->payBlock($o) === '') {
            $menu[] = ['icon' => 'icon-money', 'text' => 'Cobrar', 'onclick' => "orderPay.open({$id})"];
        }

        if (in_array('print', $actions, true)) {
            $menu[] = ['icon' => 'icon-print', 'text' => 'Imprimir', 'onclick' => "orderDetail.print({$id})"];
        }

        if (in_array('cancel', $actions, true) && $this->cancelBlock($o) === '') {
            $menu[] = ['icon' => 'icon-cancel', 'text' => 'Cancelar', 'onclick' => "orderForm.cancel({$id})"];
        }

        return [
            'id'               => $id,
            'Folio'            => $this->cellFolio($id, $o['folio'], $inTurn, $cancelled),
            'Creación'         => '<span class="text-gray-600">' . dmy($o['created_at']) . '</span>',
            'Cliente'          => $this->cellCustomer($o['customer'], $o['phone'], $custom),
            'Total'            => $this->cellTotal($o['total'], $o['subtotal'], $o['discount_amount']),
            'Abono'            => $this->cellPaid($o['paid']),
            'Saldo'            => $this->cellBalance((float) $o['total'] - (float) $o['paid']),
            'Fecha de entrega' => $this->cellDeliveryDate($o['delivery_date']),
            'Hora'             => '<span class="text-gray-600 whitespace-nowrap">' . hour12($o['delivery_time']) . '</span>',
            'Estado'           => $this->statusPill($statusId, $o['status']),
            'Entregado'        => $this->cellDelivered($statusId, (int) $o['delivery_status']),
            'Entrega'          => $this->cellMethod((int) $o['delivery_method']),
            'dropdown'         => $menu
        ];
    }

    // -- Celdas --

    private function cellFolio($id, $folio, $inTurn, $cancelled) {
        $dot  = $inTurn ? '<span class="ord-dot" aria-label="Del turno abierto"></span>' : '';
        $mark = $cancelled ? ' data-cancelled="1"' : '';

        return '<button type="button" class="ord-folio" onclick="orderDetail.show(' . (int) $id . ')"' . $mark . '>'
             .   $dot . 'P' . h($folio !== null && $folio !== '' ? $folio : $id)
             . '</button>';
    }

    private function cellCustomer($name, $phone, $custom) {
        $icon = $custom
              ? '<i data-lucide="cake" class="w-3.5 h-3.5 text-blue-600 shrink-0" aria-label="Pastel personalizado"></i>'
              : '';

        $html = '<div class="flex items-center gap-1.5 font-semibold text-gray-800">'
              .   $icon . '<span class="ord-cliente">' . h($name !== '' ? $name : 'Sin cliente') . '</span>'
              . '</div>';

        if ($phone !== '') $html .= '<div class="ord-sub">' . h($phone) . '</div>';

        return $html;
    }

    // Con descuento: el neto en verde y el bruto tachado debajo.
    private function cellTotal($total, $subtotal, $discount) {
        if ((float) $discount > 0) {
            return '<div class="font-bold text-emerald-700 whitespace-nowrap">' . money($total) . '</div>'
                 . '<div class="text-[11px] text-gray-400 line-through whitespace-nowrap">' . money($subtotal) . '</div>';
        }

        return '<span class="font-semibold text-gray-800 whitespace-nowrap">' . money($total) . '</span>';
    }

    private function cellPaid($paid) {
        $tone = (float) $paid > 0 ? 'text-emerald-700' : 'text-gray-400';

        return '<span class="' . $tone . ' whitespace-nowrap">' . money($paid) . '</span>';
    }

    // Negativo = pago de mas: se muestra como saldo a favor del cliente.
    private function cellBalance($balance) {
        $balance = round($balance, 2);

        if ($balance > 0) {
            return '<span class="font-bold text-red-600 whitespace-nowrap">' . money($balance) . '</span>';
        }

        if ($balance < 0) {
            return '<span class="font-semibold text-sky-700 whitespace-nowrap">' . money(abs($balance)) . '</span>'
                 . '<div class="ord-sub">a favor</div>';
        }

        return '<span class="text-gray-400 whitespace-nowrap">$0.00</span>';
    }

    // "Hoy" y "Mañana" en ambar debajo de la fecha.
    private function cellDeliveryDate($date) {
        if (!$date) return '<span class="text-gray-400">Sin fecha</span>';

        $day  = date('Y-m-d', strtotime($date));
        $tag  = '';

        if ($day === date('Y-m-d'))                         $tag = 'Hoy';
        if ($day === date('Y-m-d', strtotime('+1 day')))    $tag = 'Mañana';

        return '<span class="text-gray-800 whitespace-nowrap">' . dmy($date) . '</span>'
             . ($tag !== '' ? '<div class="text-[11px] font-semibold text-amber-600">' . $tag . '</div>' : '');
    }

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

    // Una cotizacion o un pedido cancelado no se entregan.
    private function cellDelivered($statusId, $deliveryStatus) {
        if ($statusId === self::QUOTE || $statusId === self::CANCELLED) {
            return '<span class="ord-sub">No aplica</span>';
        }

        if ($deliveryStatus === 1) {
            return '<span class="ord-pill bg-emerald-50 text-emerald-700">'
                 .   '<i data-lucide="circle-check" class="w-3.5 h-3.5"></i>Entregado'
                 . '</span>';
        }

        if ($deliveryStatus === 2) {
            return '<span class="font-semibold text-blue-600 whitespace-nowrap">En producción</span>';
        }

        return '<span class="text-gray-400 whitespace-nowrap">Sin entregar</span>';
    }

    private function cellMethod($method) {
        list($icon, $text) = $method === 1 ? ['truck', 'Envío a domicilio'] : ['package', 'Recoge en tienda'];

        return '<span class="inline-flex items-center gap-1.5 text-gray-600 whitespace-nowrap">'
             .   '<i data-lucide="' . $icon . '" class="w-4 h-4 text-gray-400"></i>' . $text
             . '</span>';
    }

    // -- Detalle --

    public function getOrder() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $branch = $this->scope()['branch'];
            $order  = $id > 0 ? $this->qGetOrder($id, $this->branchId()) : null;

            if (!$order) {
                return $this->fail(404, "El pedido P{$id} no existe en {$branch}.");
            }

            $lines    = $this->qOrderLines($id);
            $lineIds  = array_map('intval', array_column($lines, 'id'));
            $images   = $this->groupBy($this->qLineImages($lineIds), 'detail_sale_id');
            $customs  = [];

            foreach ($lines as $line) {
                if ((int) $line['is_custom'] === 1) $customs[] = (int) $line['product_id'];
            }

            $modifiers = $this->groupBy($this->qProductModifiers(array_values(array_unique($customs))), 'product_id');

            foreach ($lines as &$line) {
                $line['images']    = isset($images[$line['id']]) ? $images[$line['id']] : [];
                $line['modifiers'] = ((int) $line['is_custom'] === 1 && isset($modifiers[$line['product_id']]))
                                   ? $modifiers[$line['product_id']]
                                   : [];

                foreach ($line['modifiers'] as &$modifier) {
                    $modifier['multiple'] = $this->isMultiple($modifier['is_extra'], $modifier['group_name'], $modifier['modifier_group_id']);
                }
                unset($modifier);
            }
            unset($line);

            return [
                'status'   => 200,
                'branch'   => $branch,
                'order'    => $order,
                'lines'    => $lines,
                'payments' => $this->qPayments($id),
                'history'  => $this->qHistory($id),
                'actions'  => $this->actions(),
                'can'      => $this->orderCan($order)
            ];
        }, 'No se pudo abrir el pedido.');
    }

    // Lo que se puede hacer con el pedido y, si no, por que.
    private function orderCan($order) {
        $edit   = $this->need('update') === null ? $this->editBlock($order) : 'Tu rol no puede editar pedidos.';
        $cancel = $this->need('cancel') === null ? $this->cancelBlock($order) : 'Tu rol no puede cancelar pedidos.';
        $pay    = $this->need('create') === null ? $this->payBlock($order) : 'Tu rol no puede cobrar pedidos.';
        $money  = $this->moneyBlock($order);
        $alive  = (int) $order['sale_status_id'] !== self::CANCELLED;

        return [
            'edit'           => $edit === '',
            'edit_reason'    => $edit,
            'money'          => $money === '',
            'money_reason'   => $money,
            'cut'            => $this->closedCut($order),
            'cancel'         => $cancel === '',
            'cancel_reason'  => $cancel,
            'pay'            => $pay === '',
            'pay_reason'     => $pay,
            'delete_payment' => $alive && $this->need('delete') === null
        ];
    }

    // -- Reglas de captura --

    // '' = se puede editar. Si no, el motivo en una frase.
    private function editBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED) return 'Un pedido cancelado no se edita.';
        if ($status === self::PAID)      return 'Un pedido pagado no se edita.';
        if ($status !== self::QUOTE && $status !== self::PENDING) return 'Este pedido no se puede editar en su estado actual.';
        if ((int) $o['delivery_status'] === 1) return 'Un pedido entregado no se edita.';

        return '';
    }

    // '' = se puede cancelar. Con abonos hace falta cliente: ahi queda el saldo a favor.
    private function cancelBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED) return 'El pedido ya está cancelado.';
        if ($status === self::PAID)      return 'Un pedido pagado no se cancela.';
        if ($status !== self::QUOTE && $status !== self::PENDING) return 'Este pedido no se puede cancelar en su estado actual.';
        if ((int) $o['delivery_status'] === 1) return 'Un pedido entregado no se cancela.';
        if ((float) $o['paid'] > 0 && (int) $o['customer_id'] <= 0) {
            return 'Tiene abonos por ' . money($o['paid']) . ' y no tiene cliente: no hay a quién dejar el saldo a favor.';
        }

        return '';
    }

    /*  Opcion "multiple" del pastel: se suma por cantidad, no por porcion.
        Igual que alpha: grupo marcado como extra o cuyo nombre dice "decoraci".
        Sin grupo tambien cuenta como multiple (no hay grupo que limite a una). */
    private function isMultiple($isExtra, $groupName, $groupId = 1) {
        if ((int) $groupId <= 0) return true;
        if ((int) $isExtra === 1) return true;

        return mb_stripos((string) $groupName, 'decoraci', 0, 'UTF-8') !== false;
    }

    // Capturar = crear o editar: con una de las dos se abre el formulario.
    private function needCapture() {
        if ($this->need('create') === null || $this->need('update') === null) return null;

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para capturar pedidos en esta sucursal.', 'row' => []];
    }

    // -- Captura: opciones --

    public function formOptions() {
        $fail = $this->needCapture() ?: $this->needBranch();
        if (!$fail && $this->post('is_new') === '1') $fail = $this->needTurn();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $customers  = [];
            $products   = [];
            $categories = [];
            $groups     = [];

            foreach ($this->qCustomerOptions($this->branchId(), $this->postId('customer_id')) as $c) {
                $customers[] = ['id' => (int) $c['id'], 'valor' => $this->customerLabel($c['name'], $c['phone'])];
            }

            foreach ($this->qCatalogProducts($this->companyId(), $this->branchId(), $this->mainBranchId()) as $p) {
                $category = $p['category'] !== '' ? $p['category'] : 'Sin categoría';
                $key      = mb_strtolower($category, 'UTF-8');

                if (!isset($categories[$key])) {
                    $categories[$key] = ['id' => (int) $p['category_id'], 'name' => $category, 'total' => 0];
                }

                $categories[$key]['total']++;
                $categoryId = $categories[$key]['id'];

                $products[] = [
                    'id'          => (int) $p['id'],
                    'valor'       => $p['name'] . ' · ' . money($p['price']),
                    'name'        => $p['name'],
                    'price'       => (float) $p['price'],
                    'category_id' => $categoryId,
                    'category'    => $category,
                    'image'       => $p['image'],
                    'sku'         => $p['sku'],
                    'barcode'     => $p['barcode']
                ];
            }

            usort($categories, fn ($a, $b) => strcasecmp($a['name'], $b['name']));

            foreach ($this->qModifierOptions($this->companyId()) as $m) {
                $groupId = (int) $m['group_id'];

                if (!isset($groups[$groupId])) {
                    $groups[$groupId] = [
                        'id'       => $groupId,
                        'name'     => $m['group_name'],
                        'multiple' => $this->isMultiple($m['is_extra'], $m['group_name'], $groupId),
                        'options'  => []
                    ];
                }

                $groups[$groupId]['options'][] = [
                    'id'    => (int) $m['id'],
                    'valor' => $m['name'] . ' · ' . money($m['price']),
                    'name'  => $m['name'],
                    'price' => (float) $m['price']
                ];
            }

            return [
                'status'     => 200,
                'branch'     => $this->scope()['branch'],
                'today'      => date('Y-m-d'),
                'customers'  => $customers,
                'products'   => $products,
                'categories' => $categories,
                'groups'     => array_values($groups),
                'actions'    => $this->actions()
            ];
        }, 'No se pudieron cargar las opciones del pedido.');
    }

    private function customerLabel($name, $phone) {
        $name = trim((string) $name) !== '' ? trim($name) : 'Sin nombre';

        return trim((string) $phone) !== '' ? $name . ' · ' . trim($phone) : $name;
    }

    // -- Captura: cliente nuevo --

    // Un telefono que ya existe en la sucursal no duplica: se devuelve ese cliente.
    public function addCustomer() {
        $fail = $this->needCapture() ?: $this->needBranch();
        if ($fail) return $fail;

        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));

        if ($name === '')               return $this->fail(422, 'Escribe el nombre del cliente.');
        if ($this->tooLong($name, 120)) return $this->fail(422, 'El nombre admite hasta 120 caracteres.');
        if (strlen($phone) !== 10)      return $this->fail(422, 'El teléfono debe tener 10 dígitos.');

        return $this->attempt(function () use ($name, $phone) {
            return $this->transaction(function () use ($name, $phone) {
                $found = $this->qFindCustomerByPhone($this->branchId(), $phone);

                if ($found) {
                    $label = $found['name'] !== '' ? $found['name'] : 'otro cliente';

                    return $this->ok("Ese teléfono ya es de {$label}. Se eligió ese cliente.", [
                        'existing' => true,
                        'customer' => ['id' => (int) $found['id'], 'valor' => $this->customerLabel($found['name'], $found['phone'])]
                    ]);
                }

                $this->must($this->qCreateCustomer([
                    'values' => ['name', 'phone', 'branch_id', 'active'],
                    'data'   => [$name, $phone, $this->branchId(), 1]
                ]), 'addCustomer');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCustomer: sin id');

                return $this->ok('Cliente agregado.', [
                    'existing' => false,
                    'customer' => ['id' => $id, 'valor' => $this->customerLabel($name, $phone)]
                ]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    // -- Captura: fotos --

    /*  Las fotos se suben al elegirlas y se ligan al guardar el pedido. Las que
        nunca se guardan se quedan en la carpeta sin registro (aceptado). */
    public function uploadImages() {
        $fail = $this->needCapture() ?: $this->needBranch();
        if ($fail) return $fail;

        $files = isset($_FILES['archivos']) && is_array($_FILES['archivos']['name']) ? $_FILES['archivos'] : null;

        if (!$files || count($files['name']) === 0) return $this->fail(422, 'No llegó ninguna foto.');
        if (count($files['name']) > self::MAX_PHOTOS) return $this->fail(422, 'Sube hasta ' . self::MAX_PHOTOS . ' fotos a la vez.');

        return $this->attempt(function () use ($files) {
            $folder = $this->imageFolder();
            $disk   = $this->diskPath($folder);

            if (!is_dir($disk) && !@mkdir($disk, 0775, true) && !is_dir($disk)) {
                throw new RuntimeException('uploadImages: no se pudo crear ' . $disk);
            }

            $images = [];
            $errors = [];

            foreach ($files['name'] as $i => $original) {
                $original = trim(basename((string) $original));
                $label    = $original !== '' ? $original : 'Foto ' . ($i + 1);

                if ((int) $files['error'][$i] !== UPLOAD_ERR_OK) { $errors[] = "{$label}: no se pudo subir."; continue; }
                if ((int) $files['size'][$i] > self::IMAGE_MAX)  { $errors[] = "{$label}: pesa más de 5 MB."; continue; }

                $info = @getimagesize($files['tmp_name'][$i]);

                if ($info === false || !isset($this->imageTypes[$info[2]])) {
                    $errors[] = "{$label}: solo se aceptan JPG, PNG, WEBP o GIF.";
                    continue;
                }

                $name = 'cake_' . bin2hex(random_bytes(8)) . '.' . $this->imageTypes[$info[2]];

                if (!move_uploaded_file($files['tmp_name'][$i], $disk . $name)) {
                    $errors[] = "{$label}: no se pudo guardar.";
                    continue;
                }

                $images[] = ['path' => $folder . $name, 'name' => $name, 'original_name' => mb_substr($label, 0, 255, 'UTF-8')];
            }

            if (empty($images)) {
                return ['status' => 422, 'message' => implode(' ', $errors), 'images' => [], 'errors' => $errors];
            }

            $message = count($images) === 1 ? 'Foto agregada.' : count($images) . ' fotos agregadas.';

            return $this->ok($message, ['images' => $images, 'errors' => $errors]);
        }, 'No se pudieron subir las fotos.');
    }

    // Relativa a la raiz del sitio, como las de alpha ("alpha_files/..."): el detalle la pinta con "/".
    private function imageFolder() {
        return 'pro_files/' . $this->companyId() . '/' . $this->branchId() . '/order/custom/';
    }

    private function diskPath($relative) {
        $root = isset($_SERVER['DOCUMENT_ROOT']) ? str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']) : '';

        return rtrim($root, '/') . '/' . $relative;
    }

    // -- Captura: guardar --

    public function addOrder() {
        $fail = $this->need('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $token = $this->post('token');
        $again = $this->tokenResult($token);
        if ($again) return $again;

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () {
            $in = $this->orderInput(null);
            if (isset($in['status'])) return $in;

            $lines = $this->resolveLines($in['lines'], null);
            if (isset($lines['status'])) return $lines;

            $subtotal = $this->linesTotal($lines);

            return $this->transaction(function () use ($in, $lines, $subtotal) {
                $turn = $this->qOpenTurn($this->branchId());

                $this->must($this->qCreateOrder([
                    'values' => [
                        'branch_id', 'customer_id', 'user_id', 'turn_id', 'sale_type_id', 'sale_status_id',
                        'delivery_method', 'delivery_status', 'delivery_date', 'delivery_time', 'location', 'note',
                        'subtotal', 'discount_amount', 'total', 'active'
                    ],
                    'data' => [
                        $this->branchId(), $in['customer_id'], $this->userId() ?: null, $turn ? (int) $turn['id'] : null, 1, self::QUOTE,
                        $in['delivery_method'], 0, $in['delivery_date'], $in['delivery_time'], $in['location'], $in['note'],
                        $subtotal, 0, $subtotal, 1
                    ]
                ]), 'addOrder');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addOrder: sin id');

                $this->must($this->qUpdateOrder(['values' => ['folio'], 'where' => ['id'], 'data' => [(string) $id, $id]]), 'addOrder folio');

                foreach ($lines as $line) {
                    $this->createLine($id, $line);
                }

                $this->log($id, 'event', 'Pedido creado',
                    'Pedido creado como cotización — total ' . money($subtotal) . ', ' . $this->productsText(count($lines)));

                return $this->ok("Pedido P{$id} guardado como cotización.", ['id' => $id]);
            });
        }, 'No se pudo guardar el pedido.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    public function editOrder() {
        $fail = $this->need('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $token = $this->post('token');
        $again = $this->tokenResult($token);
        if ($again) return $again;

        $answer = $this->attempt(function () use ($id) {
            return $this->transaction(function () use ($id) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->editBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $in = $this->orderInput($order);
                if (isset($in['status'])) return $in;

                $current = $this->currentLines($id);
                $lines   = $this->resolveLines($in['lines'], $current);
                if (isset($lines['status'])) return $lines;

                $subtotal = $this->linesTotal($lines);
                $total    = round($subtotal - (float) $order['discount_amount'], 2);

                if ($total < 0) {
                    return $this->fail(422, 'El total no puede quedar por debajo del descuento de ' . money($order['discount_amount']) . '.');
                }

                if ($total < round((float) $order['paid'], 2)) {
                    return $this->fail(422, 'El total (' . money($total) . ') quedaría por debajo de lo abonado (' . money($order['paid']) . ').');
                }

                // Antes de escribir: transaction() confirma lo hecho aunque se devuelva un fail.
                $retotal = round((float) $order['total'], 2) !== $total;
                $money   = $retotal ? $this->moneyBlock($order) : '';
                if ($money !== '') return $this->fail(409, $money);

                $changes = $this->headerChanges($order, $in);
                $kept    = [];

                foreach ($lines as $line) {
                    if ($line['id'] > 0) {
                        $kept[$line['id']] = true;
                        $changes = array_merge($changes, $this->updateLine($line, $current));
                    } else {
                        $this->createLine($id, $line);
                        $changes[] = 'Agregó ' . $line['name'] . ' ×' . $line['quantity'];
                    }
                }

                foreach ($current['lines'] as $lineId => $old) {
                    if (isset($kept[$lineId])) continue;

                    $this->must($this->qUpdateLine([
                        'values' => ['active', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [0, $lineId]
                    ]), 'editOrder quitar linea');

                    $changes[] = 'Quitó ' . $old['name'];
                }

                if (empty($changes)) return $this->ok('Sin cambios.', ['id' => $id, 'unchanged' => true]);

                if ($retotal) {
                    $changes[] = 'Total: ' . money($order['total']) . ' » ' . money($total);

                    if ($this->cutNote($order) !== '' && (int) $order['sale_status_id'] === self::PENDING) $changes[] = $this->cutNote($order);
                }

                $this->must($this->qUpdateOrder([
                    'values' => [
                        'customer_id', 'delivery_method', 'delivery_date', 'delivery_time', 'location', 'note',
                        'subtotal', 'total', 'edit_user_id', 'updated_at = NOW()'
                    ],
                    'where' => ['id'],
                    'data'  => [
                        $in['customer_id'], $in['delivery_method'], $in['delivery_date'], $in['delivery_time'], $in['location'], $in['note'],
                        $subtotal, $total, $this->userId() ?: null, $id
                    ]
                ]), 'editOrder');

                $this->log($id, 'edition', 'Pedido editado', implode(' · ', $changes));

                return $this->ok("Pedido P{$id} actualizado.", ['id' => $id]);
            });
        }, 'No se pudo guardar el pedido.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    public function cancelOrder() {
        $fail = $this->need('cancel') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0)                     return $this->fail(422, 'Falta el pedido.');
        if ($reason === '')               return $this->fail(422, 'Escribe el motivo de la cancelación.');
        if ($this->tooLong($reason, 255)) return $this->fail(422, 'El motivo admite hasta 255 caracteres.');

        return $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->cancelBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $this->must($this->qUpdateOrder([
                    'values' => ['sale_status_id', 'cancel_reason', 'cancelled_at = NOW()', 'cancel_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [self::CANCELLED, $reason, $this->userId() ?: null, $id]
                ]), 'cancelOrder');

                $cutNote = $this->cutNote($order);

                $this->log($id, 'cancellation', 'Pedido cancelado', 'Motivo: ' . $reason . ($cutNote !== '' ? ' · ' . $cutNote : ''));

                $paid    = round((float) $order['paid'], 2);
                $message = "Pedido P{$id} cancelado." . ($cutNote !== '' ? ' ' . $cutNote : '');

                if ($paid > 0) {
                    $customerId = (int) $order['customer_id'];

                    $this->must($this->qUpdateCustomer([
                        'values' => ['wallet = IFNULL(wallet, 0) + ?', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$paid, $customerId]
                    ]), 'cancelOrder wallet');

                    $name    = $this->qCustomerName($customerId) ?: 'el cliente';
                    $wallet  = 'El anticipo de ' . money($paid) . ' queda como saldo a favor de ' . $name . '.';
                    $message = "Pedido P{$id} cancelado. " . $wallet . ($cutNote !== '' ? ' ' . $cutNote : '');

                    $this->log($id, 'payment', 'Saldo a favor', $wallet);
                }

                return $this->ok($message, ['id' => $id, 'wallet' => $paid]);
            });
        }, 'No se pudo cancelar el pedido.');
    }

    // -- Captura: lectura y validacion --

    /*  El encabezado del pedido, limpio. $current = el pedido bloqueado (editar)
        o null (nuevo). Devuelve los campos o la respuesta 422. */
    private function orderInput($current) {
        $customerId = $this->postId('customer_id');
        $method     = $this->post('delivery_method') === '1' ? 1 : 0;
        $date       = $this->postDate('delivery_date', null);
        $time       = $this->postTime('delivery_time');
        $location   = $method === 1 ? trim((string) preg_replace('/\s+/u', ' ', $this->post('location'))) : '';
        $note       = $this->textOrNull('note');
        $lines      = $this->postedJson('lines');

        if ($customerId <= 0) return $this->fail(422, 'Elige el cliente.');

        $customer = $this->qGetCustomer($customerId);
        $isSame   = $current !== null && (int) $current['customer_id'] === $customerId;
        $isLocal  = $customer && (int) $customer['branch_id'] === $this->branchId() && (int) $customer['active'] === 1;

        if (!$customer || (!$isLocal && !$isSame)) return $this->fail(422, 'Ese cliente no está disponible en esta sucursal.');

        if ($date === null) return $this->fail(422, 'Elige la fecha de entrega.');
        if ($time === null) return $this->fail(422, 'Elige la hora de entrega.');

        $dateChanged = $current === null || (string) $current['delivery_date'] !== $date;

        if ($dateChanged && $date < date('Y-m-d')) return $this->fail(422, 'La fecha de entrega no puede ser anterior a hoy.');

        if ($method === 1 && $location === '')    return $this->fail(422, 'Escribe la dirección de envío.');
        if ($this->tooLong($location, 255))       return $this->fail(422, 'La dirección admite hasta 255 caracteres.');
        if ($this->tooLong($note, 2000))          return $this->fail(422, 'La nota admite hasta 2,000 caracteres.');

        if (!is_array($lines) || count($lines) === 0) return $this->fail(422, 'Agrega al menos un producto.');
        if (count($lines) > self::MAX_LINES)          return $this->fail(422, 'Un pedido admite hasta ' . self::MAX_LINES . ' productos.');

        return [
            'customer_id'     => $customerId,
            'customer'        => $customer['name'],
            'delivery_method' => $method,
            'delivery_date'   => $date,
            'delivery_time'   => $time,
            'location'        => $location === '' ? null : $location,
            'note'            => $note,
            'lines'           => array_values($lines)
        ];
    }

    // Lo guardado del pedido, por id: lineas, fotos por linea y opciones por producto.
    private function currentLines($saleId) {
        $lines    = [];
        $products = [];

        foreach ($this->qOrderLines($saleId) as $line) {
            $lines[(int) $line['id']] = $line;

            if ((int) $line['is_custom'] === 1) $products[] = (int) $line['product_id'];
        }

        $images = [];

        foreach ($this->qLineImages(array_keys($lines)) as $image) {
            $images[(int) $image['detail_sale_id']][(int) $image['id']] = $image;
        }

        $modifiers = [];

        foreach ($this->qProductModifiers(array_values(array_unique($products))) as $modifier) {
            $modifiers[(int) $modifier['product_id']][(int) $modifier['modifier_id']] = $modifier;
        }

        return ['lines' => $lines, 'images' => $images, 'modifiers' => $modifiers];
    }

    /*  Cada linea del navegador, validada y con los datos que mandan desde la
        base. $current = currentLines() al editar, null en un pedido nuevo.
        Devuelve la lista o la respuesta de error. */
    private function resolveLines(array $raw, $current) {
        $resolved = [];
        $seen     = [];

        foreach ($raw as $n => $item) {
            $pos = 'Producto ' . ($n + 1);

            if (!is_array($item)) return $this->fail(422, "{$pos}: llegó vacío.");

            $id   = isset($item['id']) ? (int) $item['id'] : 0;
            $type = isset($item['type']) ? (string) $item['type'] : '';

            if (!in_array($type, ['product', 'free', 'custom'], true)) return $this->fail(422, "{$pos}: tipo desconocido.");

            $old = null;

            if ($id > 0) {
                if ($current === null || !isset($current['lines'][$id]) || isset($seen[$id])) {
                    return $this->fail(409, "{$pos}: ya no es parte del pedido. Vuelve a abrirlo.");
                }

                $old  = $current['lines'][$id];
                $seen[$id] = true;

                if ($this->lineType($old) !== $type) return $this->fail(409, "{$pos}: no coincide con lo guardado. Vuelve a abrir el pedido.");
            }

            $quantity   = $this->intOf(isset($item['quantity']) ? $item['quantity'] : '');
            $details    = $this->cleanText(isset($item['details']) ? $item['details'] : '');
            $dedication = $this->cleanText(isset($item['dedication']) ? $item['dedication'] : '');

            if ($quantity === null || $quantity < 1 || $quantity > 9999) return $this->fail(422, "{$pos}: la cantidad va de 1 a 9,999.");
            if ($this->tooLong($details, 255))    return $this->fail(422, "{$pos}: los detalles admiten hasta 255 caracteres.");
            if ($this->tooLong($dedication, 255)) return $this->fail(422, "{$pos}: la dedicatoria admite hasta 255 caracteres.");

            $line = [
                'id'         => $id,
                'type'       => $type,
                'product_id' => null,
                'name'       => '',
                'price'      => 0,
                'quantity'   => $quantity,
                'details'    => $details,
                'dedication' => $dedication,
                'portions'   => null,
                'suggested'  => null,
                'modifiers'  => [],
                'images'     => []
            ];

            if ($type === 'product') {
                if ($old) {
                    $line['product_id'] = (int) $old['product_id'];
                    $line['name']       = $old['name'];
                    $line['price']      = (float) $old['price'];
                } else {
                    $productId = isset($item['product_id']) ? (int) $item['product_id'] : 0;
                    $product   = $productId > 0 ? $this->qGetCatalogProduct($productId, $this->companyId(), $this->branchId(), $this->mainBranchId()) : null;

                    if (!$product) return $this->fail(422, "{$pos}: ese producto ya no está en el catálogo.");

                    $line['product_id'] = (int) $product['id'];
                    $line['name']       = $product['name'];
                    $line['price']      = (float) $product['price'];
                }
            }

            if ($type === 'free') {
                $name  = $this->cleanText(isset($item['name']) ? $item['name'] : '');
                $price = $this->amountOf(isset($item['price']) ? $item['price'] : '', null);

                if ($name === null)                         return $this->fail(422, "{$pos}: escribe el nombre.");
                if ($this->tooLong($name, 150))             return $this->fail(422, "{$pos}: el nombre admite hasta 150 caracteres.");
                if ($price === null || $price > 999999)     return $this->fail(422, "{$pos}: escribe un precio válido.");

                $line['name']  = $name;
                $line['price'] = $price;
            }

            if ($type === 'custom') {
                $cake = $this->resolveCake($item, $old, $current, $pos);
                if (isset($cake['status'])) return $cake;

                $line = array_merge($line, $cake);
            }

            $resolved[] = $line;
        }

        return $resolved;
    }

    // Pastel personalizado: nombre, porciones, opciones con precio de la base y fotos.
    private function resolveCake(array $item, $old, $current, $pos) {
        $name     = $this->cleanText(isset($item['name']) ? $item['name'] : '');
        $portions = $this->intOf(isset($item['portions']) ? $item['portions'] : '');
        $wanted   = isset($item['modifiers']) && is_array($item['modifiers']) ? $item['modifiers'] : [];
        $photos   = isset($item['images']) && is_array($item['images']) ? $item['images'] : [];

        if ($name === null)                                   return $this->fail(422, "{$pos}: escribe el nombre del pastel.");
        if ($this->tooLong($name, 150))                       return $this->fail(422, "{$pos}: el nombre admite hasta 150 caracteres.");
        if ($portions === null || $portions < 1 || $portions > 999) return $this->fail(422, "{$pos}: las porciones van de 1 a 999.");
        if (count($photos) > self::MAX_PHOTOS)                return $this->fail(422, "{$pos}: admite hasta " . self::MAX_PHOTOS . ' fotos.');

        $productId = $old ? (int) $old['product_id'] : 0;
        $saved     = ($old && isset($current['modifiers'][$productId])) ? $current['modifiers'][$productId] : [];

        $ids = [];

        foreach ($wanted as $m) {
            $modifierId = is_array($m) && isset($m['id']) ? (int) $m['id'] : 0;

            if ($modifierId <= 0 || isset($ids[$modifierId])) return $this->fail(422, "{$pos}: hay una opción repetida o vacía.");

            $ids[$modifierId] = is_array($m) && isset($m['quantity']) ? $m['quantity'] : 1;
        }

        if (empty($ids)) return $this->fail(422, "{$pos}: elige al menos una opción del pastel.");

        $catalog = [];

        foreach ($this->qModifiersByIds(array_keys($ids), $this->companyId()) as $row) {
            $catalog[(int) $row['id']] = $row;
        }

        $modifiers = [];
        $perGroup  = [];
        $base      = 0;
        $extras    = 0;

        foreach ($ids as $modifierId => $rawQty) {
            if (isset($saved[$modifierId])) {
                $source   = $saved[$modifierId];
                $price    = (float) $source['price'];
                $groupId  = (int) $source['modifier_group_id'];
                $multiple = $this->isMultiple($source['is_extra'], $source['group_name'], $groupId);
                $label    = $source['group_name'];
            } elseif (isset($catalog[$modifierId]) && (int) $catalog[$modifierId]['alive'] === 1) {
                $source   = $catalog[$modifierId];
                $price    = (float) $source['price'];
                $groupId  = (int) $source['group_id'];
                $multiple = $this->isMultiple($source['is_extra'], $source['group_name'], $groupId);
                $label    = $source['group_name'];
            } else {
                return $this->fail(422, "{$pos}: una de las opciones ya no existe. Quítala y elige otra.");
            }

            $quantity = $multiple ? $this->intOf($rawQty) : 1;

            if ($quantity === null || $quantity < 1 || $quantity > 999) return $this->fail(422, "{$pos}: la cantidad de cada extra va de 1 a 999.");

            if (!$multiple) {
                if (isset($perGroup[$groupId])) return $this->fail(422, "{$pos}: elige solo una opción de «{$label}».");

                $perGroup[$groupId] = true;
                $base += $price;
            } else {
                $extras += $price * $quantity;
            }

            $modifiers[] = ['modifier_id' => $modifierId, 'quantity' => $quantity, 'price' => $price];
        }

        $suggested = round($base * $portions + $extras, 2);
        $price     = $this->amountOf(isset($item['price']) ? $item['price'] : '', $suggested);

        if ($price === null || $price > 999999) return $this->fail(422, "{$pos}: escribe un precio válido o déjalo vacío para usar el sugerido.");

        $savedImages = ($old && isset($current['images'][(int) $old['id']])) ? $current['images'][(int) $old['id']] : [];
        $folder      = $this->imageFolder();
        $images      = [];
        $paths       = [];

        foreach ($photos as $photo) {
            if (!is_array($photo)) return $this->fail(422, "{$pos}: una foto llegó vacía.");

            if (!empty($photo['id'])) {
                if (!isset($savedImages[(int) $photo['id']])) return $this->fail(409, "{$pos}: una foto ya no es parte del pedido. Vuelve a abrirlo.");

                $images[] = ['id' => (int) $photo['id']];
                continue;
            }

            $file = isset($photo['name']) ? (string) $photo['name'] : '';
            $path = isset($photo['path']) ? (string) $photo['path'] : '';

            $valid = preg_match('/^cake_[a-f0-9]{16}\.(jpe?g|png|webp|gif)$/', $file)
                  && $path === $folder . $file
                  && !isset($paths[$path])
                  && is_file($this->diskPath($path));

            if (!$valid) return $this->fail(422, "{$pos}: una foto no se encontró. Vuelve a subirla.");

            $paths[$path] = true;
            $original     = $this->cleanText(isset($photo['original_name']) ? $photo['original_name'] : '');

            $images[] = ['id' => 0, 'path' => $path, 'name' => $file, 'original_name' => $original !== null ? mb_substr($original, 0, 255, 'UTF-8') : $file];
        }

        return [
            'product_id' => $productId > 0 ? $productId : null,
            'name'       => $name,
            'price'      => $price,
            'portions'   => $portions,
            'suggested'  => $suggested,
            'modifiers'  => $modifiers,
            'images'     => $images
        ];
    }

    private function lineType($line) {
        if ((int) $line['is_custom'] === 1) return 'custom';

        return $line['product_id'] === null || $line['product_id'] === '' ? 'free' : 'product';
    }

    // Texto de una sola linea, sin espacios de mas. Vacio = null.
    private function cleanText($value) {
        $value = trim((string) preg_replace('/\s+/u', ' ', (string) $value));

        return $value === '' ? null : $value;
    }

    private function linesTotal(array $lines) {
        $total = 0;

        foreach ($lines as $line) {
            $total += $line['price'] * $line['quantity'];
        }

        return round($total, 2);
    }

    private function productsText($count) {
        return $count === 1 ? '1 producto' : "{$count} productos";
    }

    // -- Captura: escritura de lineas --

    private function createLine($saleId, array $line) {
        $productId = $line['product_id'];

        if ($line['type'] === 'custom') {
            $this->must($this->qCreateProduct([
                'values' => ['name', 'kind', 'price', 'suggested_price', 'portion_qty', 'is_custom', 'sell_pos', 'in_catalog', 'company_id', 'branch_id', 'active'],
                'data'   => [$line['name'], 'product', $line['price'], $line['suggested'], $line['portions'], 1, 0, 0, $this->companyId(), $this->branchId(), 1]
            ]), 'createLine pastel');

            $productId = $this->qLastInsertId();
            if ($productId <= 0) throw new RuntimeException('createLine: pastel sin id');

            $this->createModifiers($productId, $line['modifiers']);
        }

        $this->must($this->qCreateLine([
            'values' => ['sale_id', 'product_id', 'name', 'price', 'quantity', 'details', 'dedication', 'active'],
            'data'   => [$saleId, $productId, $line['name'], $line['price'], $line['quantity'], $line['details'], $line['dedication'], 1]
        ]), 'createLine');

        $lineId = $this->qLastInsertId();
        if ($lineId <= 0) throw new RuntimeException('createLine: linea sin id');

        $this->createImages($lineId, $line['images']);
    }

    // Cambios de una linea guardada: escribe solo lo que cambio y devuelve el texto.
    private function updateLine(array $line, array $current) {
        $old     = $current['lines'][$line['id']];
        $label   = $old['name'];
        $changes = [];
        $fields  = [];
        $data    = [];

        if ($line['name'] !== $old['name']) {
            $changes[] = "{$label}: nombre » {$line['name']}";
            $fields[]  = 'name';
            $data[]    = $line['name'];
        }

        if (round($line['price'], 2) !== round((float) $old['price'], 2)) {
            $changes[] = "{$label}: precio " . money($old['price']) . ' » ' . money($line['price']);
            $fields[]  = 'price';
            $data[]    = $line['price'];
        }

        if ($line['quantity'] !== (int) round((float) $old['quantity'])) {
            $changes[] = "{$label}: cantidad " . (int) round((float) $old['quantity']) . " » {$line['quantity']}";
            $fields[]  = 'quantity';
            $data[]    = $line['quantity'];
        }

        if ($line['details'] !== $this->cleanText($old['details'])) {
            $changes[] = "{$label}: detalles actualizados";
            $fields[]  = 'details';
            $data[]    = $line['details'];
        }

        if ($line['dedication'] !== $this->cleanText($old['dedication'])) {
            $changes[] = "{$label}: dedicatoria actualizada";
            $fields[]  = 'dedication';
            $data[]    = $line['dedication'];
        }

        if ($line['type'] === 'custom') {
            $changes = array_merge($changes, $this->updateCake($line, $old, $current));
        }

        if (!empty($fields)) {
            $fields[] = 'updated_at = NOW()';
            $data[]   = $line['id'];

            $this->must($this->qUpdateLine(['values' => $fields, 'where' => ['id'], 'data' => $data]), 'updateLine');
        }

        return $changes;
    }

    // El producto del pastel, sus opciones (si cambio el conjunto) y sus fotos.
    private function updateCake(array $line, array $old, array $current) {
        $productId = (int) $old['product_id'];
        $label     = $old['name'];
        $changes   = [];

        if ((int) $old['portion_qty'] !== $line['portions']) {
            $changes[] = "{$label}: porciones " . (int) $old['portion_qty'] . " » {$line['portions']}";
        }

        $saved = isset($current['modifiers'][$productId]) ? $current['modifiers'][$productId] : [];
        $was   = [];
        $now   = [];

        foreach ($saved as $modifierId => $m) {
            $was[$modifierId] = (int) round((float) $m['quantity']);
        }

        foreach ($line['modifiers'] as $m) {
            $now[$m['modifier_id']] = $m['quantity'];
        }

        ksort($was);
        ksort($now);

        if ($was !== $now) {
            $this->must($this->qUpdateProductModifier([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['product_id', 'active = 1'],
                'data'   => [0, $productId]
            ]), 'updateCake opciones');

            $this->createModifiers($productId, $line['modifiers']);

            $changes[] = "{$label}: opciones actualizadas";
        }

        $productChanged = $was !== $now
            || $line['name'] !== $old['product_name']
            || (int) $old['portion_qty'] !== $line['portions']
            || round($line['price'], 2) !== round((float) $old['price'], 2);

        if ($productChanged) {
            $this->must($this->qUpdateProduct([
                'values' => ['name', 'price', 'suggested_price', 'portion_qty', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$line['name'], $line['price'], $line['suggested'], $line['portions'], $productId]
            ]), 'updateCake producto');
        }

        $savedImages = isset($current['images'][$line['id']]) ? $current['images'][$line['id']] : [];
        $keep        = [];
        $added       = [];

        foreach ($line['images'] as $image) {
            if ($image['id'] > 0) $keep[$image['id']] = true;
            else $added[] = $image;
        }

        $removed = 0;

        foreach ($savedImages as $imageId => $image) {
            if (isset($keep[$imageId])) continue;

            $this->must($this->qUpdateImage([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [0, $imageId]
            ]), 'updateCake quitar foto');

            $removed++;
        }

        $this->createImages($line['id'], $added);

        if (count($added) > 0 || $removed > 0) {
            $changes[] = "{$label}: fotos (+" . count($added) . ", −{$removed})";
        }

        return $changes;
    }

    private function createModifiers($productId, array $modifiers) {
        if (empty($modifiers)) return;

        $rows = [];

        foreach ($modifiers as $m) {
            $rows[] = [$productId, $m['modifier_id'], $m['quantity'], $m['price'], 1];
        }

        $this->must($this->qCreateProductModifier([
            'values' => ['product_id', 'modifier_id', 'quantity', 'price', 'active'],
            'data'   => $rows
        ]), 'createModifiers');
    }

    private function createImages($lineId, array $images) {
        $rows = [];

        foreach ($images as $image) {
            if ($image['id'] > 0) continue;

            $rows[] = [$image['path'], $image['name'], $image['original_name'], $lineId, 1];
        }

        if (empty($rows)) return;

        $this->must($this->qCreateImage([
            'values' => ['path', 'name', 'original_name', 'detail_sale_id', 'active'],
            'data'   => $rows
        ]), 'createImages');
    }

    // Los cambios del encabezado, en texto para la bitacora.
    private function headerChanges($order, array $in) {
        $changes = [];

        if ((int) $order['customer_id'] !== $in['customer_id']) {
            $before    = $this->qGetCustomer((int) $order['customer_id']);
            $changes[] = 'Cliente: ' . ($before ? $before['name'] : 'sin cliente') . ' » ' . $in['customer'];
        }

        if ((string) $order['delivery_date'] !== $in['delivery_date']) {
            $changes[] = 'Fecha de entrega: ' . (dmy($order['delivery_date']) ?: 'sin fecha') . ' » ' . dmy($in['delivery_date']);
        }

        if (substr((string) $order['delivery_time'], 0, 5) !== substr($in['delivery_time'], 0, 5)) {
            $changes[] = 'Hora: ' . (hour12($order['delivery_time']) ?: 'sin hora') . ' » ' . hour12($in['delivery_time']);
        }

        if ((int) $order['delivery_method'] !== $in['delivery_method']) {
            $names     = ['Recoge en tienda', 'Envío a domicilio'];
            $changes[] = 'Entrega: ' . $names[(int) $order['delivery_method'] === 1 ? 1 : 0] . ' » ' . $names[$in['delivery_method']];
        }

        if ($this->cleanText($order['location']) !== $in['location'] && $in['location'] !== null) {
            $changes[] = 'Dirección: ' . $in['location'];
        }

        if (trim((string) $order['note']) !== (string) $in['note']) {
            $changes[] = 'Nota actualizada';
        }

        return $changes;
    }

    // -- Ayudantes --

    private function groupBy(array $rows, $key) {
        $groups = [];

        foreach ($rows as $row) {
            $groups[$row[$key]][] = $row;
        }

        return $groups;
    }
}

Permission::dispatch(new ctrl(), core::SECTION);
