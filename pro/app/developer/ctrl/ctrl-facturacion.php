<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-developer.php';

// Seccion Facturacion: empresas, planes, suscripciones, pagos, cupones y canjes.
class ctrl extends core {

    function init() {
        return [
            'status'                    => 200,
            'statusFilter'              => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'companyStatusFilter'       => [
                ['id' => 'active',    'valor' => 'Activas'],
                ['id' => 'pending',   'valor' => 'Pendientes'],
                ['id' => 'suspended', 'valor' => 'Suspendidas'],
                ['id' => 'cancelled', 'valor' => 'Canceladas']
            ],
            'subscriptionStatusFilter'  => [
                ['id' => 'active',    'valor' => 'Activas'],
                ['id' => 'trial',     'valor' => 'Prueba'],
                ['id' => 'past_due',  'valor' => 'Vencidas'],
                ['id' => 'cancelled', 'valor' => 'Canceladas'],
                ['id' => 'expired',   'valor' => 'Expiradas']
            ],
            'billingCycles'             => [
                ['id' => 'monthly',  'valor' => 'Mensual'],
                ['id' => 'yearly',   'valor' => 'Anual'],
                ['id' => 'lifetime', 'valor' => 'De por vida']
            ],
            'companyStatusOptions'      => [
                ['id' => 'pending',   'valor' => 'Pendiente'],
                ['id' => 'active',    'valor' => 'Activa'],
                ['id' => 'suspended', 'valor' => 'Suspendida'],
                ['id' => 'cancelled', 'valor' => 'Cancelada']
            ],
            'subscriptionStatusOptions' => [
                ['id' => 'trial',     'valor' => 'Prueba'],
                ['id' => 'active',    'valor' => 'Activa'],
                ['id' => 'past_due',  'valor' => 'Vencida'],
                ['id' => 'cancelled', 'valor' => 'Cancelada'],
                ['id' => 'expired',   'valor' => 'Expirada']
            ],
            'paymentStatusFilter'       => [
                ['id' => 'paid',     'valor' => 'Pagados'],
                ['id' => 'pending',  'valor' => 'Pendientes'],
                ['id' => 'failed',   'valor' => 'Fallidos'],
                ['id' => 'refunded', 'valor' => 'Reembolsados']
            ],
            'paymentStatusOptions'      => [
                ['id' => 'pending',  'valor' => 'Pendiente'],
                ['id' => 'paid',     'valor' => 'Pagado'],
                ['id' => 'failed',   'valor' => 'Fallido'],
                ['id' => 'refunded', 'valor' => 'Reembolsado']
            ],
            'discountTypeOptions'       => [
                ['id' => 'percent', 'valor' => 'Porcentaje (%)'],
                ['id' => 'fixed',   'valor' => 'Monto fijo']
            ],
            'companies'                 => $this->qCompaniesForSelect(),
            'plans'                     => $this->qPlansForSelect(),
            'subscriptions'             => $this->qSubscriptionsForSelect()
        ];
    }

    /* ===== Empresas (companies) ===== */

    function lsCompanies() {
        $status = $this->companyStatusIn($_POST['status'] ?? 'active');
        $ls = $this->qCompanies([$status]);

        $row = [];
        foreach ($ls as $c) {
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'companies.editCompany(' . $c['id'] . ')'
            ];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-palette"></i>',
                'title'   => 'Temas',
                'onclick' => 'companies.editCompanyThemes(' . $c['id'] . ')'
            ];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral', true),
                'html'    => '<i class="icon-cog"></i>',
                'onclick' => "companies.changeStatus(" . $c['id'] . ", '" . $c['status'] . "')"
            ];

            $row[] = [
                'id'        => $c['id'],
                'Empresa'   => renderAvatar($c['name'] ?? ''),
                'RFC'       => $c['rfc'] ?: '-',
                'Base de datos' => $c['database_name'] ?: '-',
                'Ubicación' => $c['ubication'] ?: '-',
                'Estado'    => renderCompanyStatus($c['status']),
                'Creación'  => $c['created'] ?: '-',
                'a'         => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getCompany() {
        $data = $this->qCompany([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Empresa no encontrada',
            'data'    => $data
        ];
    }

    function addCompany() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la empresa es obligatorio'];
        }
        $status = $this->companyStatusIn($_POST['status'] ?? 'pending');

        $ok = $this->qInsertCompany([
            $name,
            trim($_POST['database_name'] ?? '') ?: null,
            trim($_POST['ubication'] ?? '') ?: null,
            trim($_POST['rfc'] ?? '') ?: null,
            $status
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Empresa creada correctamente' : 'No se pudo crear la empresa'
        ];
    }

    function editCompany() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la empresa es obligatorio'];
        }
        if (!$this->qCompany([$id])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        $ok = $this->qUpdateCompany([
            $name,
            trim($_POST['database_name'] ?? '') ?: null,
            trim($_POST['ubication'] ?? '') ?: null,
            trim($_POST['rfc'] ?? '') ?: null,
            $id
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Empresa actualizada correctamente' : 'No se pudo actualizar la empresa'
        ];
    }

    function changeCompanyStatus() {
        $id     = (int) $_POST['id'];
        $status = $this->companyStatusIn($_POST['status'] ?? '');
        if (!in_array($_POST['status'] ?? '', $this->companyStatuses, true)) {
            return ['status' => 400, 'message' => 'Estado de empresa no válido'];
        }
        if (!$this->qCompany([$id])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        $ok = $this->qSetCompanyStatus([$status, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Estado de la empresa actualizado' : 'No se pudo actualizar el estado'
        ];
    }

    /* ===== Temas por empresa (company_themes) ===== */

    // Temas asignables y los que ya tiene la empresa, para el modal "Temas".
    function getCompanyThemes() {
        $companyId = (int) $_POST['company_id'];
        $company   = $this->qCompany([$companyId]);

        if (!$company) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        return [
            'status'   => 200,
            'company'  => $company['name'],
            'themes'   => $this->lsAssignableThemes(),
            'selected' => array_map('intval', array_column($this->listCompanyThemes([$companyId]), 'theme_id'))
        ];
    }

    // Reemplaza los temas de la empresa por los marcados. El modal manda un checkbox por
    // tema (theme_9=true) y solo viajan los marcados. Solo entran temas asignables:
    // el de por defecto lo ven todas las empresas siempre.
    function editCompanyThemes() {
        $companyId = (int) $_POST['company_id'];

        if (!$this->qCompany([$companyId])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        $checked = [];
        foreach ($_POST as $key => $value) {
            if (preg_match('/^theme_(\d+)$/', $key, $m) && $value === 'true') $checked[] = (int) $m[1];
        }

        $assignable = array_map('intval', array_column($this->lsAssignableThemes(), 'id'));
        $selected   = array_intersect($assignable, $checked);

        $this->deleteCompanyThemesById([
            'where' => 'company_id',
            'data'  => [$companyId]
        ]);

        $now    = date('Y-m-d H:i:s');
        $failed = 0;

        foreach ($selected as $themeId) {
            $ok = $this->createCompanyTheme($this->util->sql([
                'company_id' => $companyId,
                'theme_id'   => $themeId,
                'created_at' => $now
            ]));

            if (!$ok) $failed++;
        }

        return [
            'status'  => $failed === 0 ? 200 : 500,
            'message' => $failed === 0 ? 'Temas de la empresa actualizados' : 'No se pudieron guardar todos los temas'
        ];
    }

    /* ===== Planes (plans) ===== */

    function lsPlans() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qPlans([$active]);

        $row = [];
        foreach ($ls as $p) {
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'plans.editPlan(' . $p['id'] . ')'
            ];
            if ($p['is_active'] == 1) {
                $a[] = [
                    'class'   => $this->actionBtnClass('danger', true),
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'plans.togglePlan(' . $p['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => $this->actionBtnClass('neutral', true),
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'plans.togglePlan(' . $p['id'] . ', 1)'
                ];
            }

            $price = number_format((float) $p['price'], 2) . ' ' . ($p['currency'] ?: '');
            $row[] = [
                'id'         => $p['id'],
                'Código'     => $p['code'] ?: '-',
                'Plan'       => htmlspecialchars($p['name'] ?? ''),
                'Precio'     => trim($price),
                'Ciclo'      => renderBillingCycle($p['billing_cycle']),
                'Usuarios'   => $p['max_users'] ?? '∞',
                'Sucursales' => $p['max_branches'] ?? '∞',
                'Prueba'     => ($p['trial_days'] ?? 0) . ' días',
                'Estado'     => renderActive($p['is_active']),
                'a'          => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getPlan() {
        $data = $this->qPlan([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Plan no encontrado',
            'data'    => $data
        ];
    }

    function addPlan() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del plan es obligatorio'];
        }
        $cycle = in_array($_POST['billing_cycle'] ?? '', $this->billingCycles, true)
            ? $_POST['billing_cycle'] : 'monthly';

        $ok = $this->qInsertPlan([
            trim($_POST['code'] ?? '') ?: null,
            $name,
            (float) ($_POST['price'] ?? 0),
            trim($_POST['currency'] ?? '') ?: 'MXN',
            $cycle,
            $this->intOrNull($_POST['max_users'] ?? ''),
            $this->intOrNull($_POST['max_branches'] ?? ''),
            $this->intOrNull($_POST['trial_days'] ?? '')
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Plan creado correctamente' : 'No se pudo crear el plan'
        ];
    }

    function editPlan() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del plan es obligatorio'];
        }
        if (!$this->qPlan([$id])) {
            return ['status' => 404, 'message' => 'Plan no encontrado'];
        }
        $cycle = in_array($_POST['billing_cycle'] ?? '', $this->billingCycles, true)
            ? $_POST['billing_cycle'] : 'monthly';

        $ok = $this->qUpdatePlan([
            trim($_POST['code'] ?? '') ?: null,
            $name,
            (float) ($_POST['price'] ?? 0),
            trim($_POST['currency'] ?? '') ?: 'MXN',
            $cycle,
            $this->intOrNull($_POST['max_users'] ?? ''),
            $this->intOrNull($_POST['max_branches'] ?? ''),
            $this->intOrNull($_POST['trial_days'] ?? ''),
            $id
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Plan actualizado correctamente' : 'No se pudo actualizar el plan'
        ];
    }

    function togglePlan() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];
        if (!$this->qPlan([$id])) {
            return ['status' => 404, 'message' => 'Plan no encontrado'];
        }

        $ok = $this->qSetPlanActive([$active, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Plan activado' : 'Plan desactivado') : 'No se pudo actualizar el estado'
        ];
    }

    /* ===== Suscripciones (subscriptions) ===== */

    function lsSubscriptions() {
        $status = $this->subStatusIn($_POST['status'] ?? 'active');
        $ls = $this->qSubscriptions([$status]);

        $row = [];
        foreach ($ls as $s) {
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'subscriptions.editSubscription(' . $s['id'] . ')'
            ];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral', true),
                'html'    => '<i class="icon-cog"></i>',
                'onclick' => "subscriptions.changeStatus(" . $s['id'] . ", '" . $s['status'] . "')"
            ];

            $row[] = [
                'id'        => $s['id'],
                'Empresa'   => htmlspecialchars($s['company_name'] ?? '—'),
                'Plan'      => htmlspecialchars($s['plan_name'] ?? '—'),
                'Inicio'    => $s['starts'] ?: '-',
                'Fin'       => $s['ends'] ?: '-',
                'Próx. cobro' => $s['next_billing'] ?: '-',
                'Estado'    => renderSubStatus($s['status']),
                'a'         => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getSubscription() {
        $data = $this->qSubscription([(int) $_POST['id']]);
        if ($data) {
            // El front espera strings para autorrellenar selects.
            $data['company_id'] = (string) $data['company_id'];
            $data['plan_id']    = (string) $data['plan_id'];
            // Los inputs type=date esperan 'YYYY-MM-DD' (recortar la parte de hora).
            $data['starts_at']         = $data['starts_at']         ? substr($data['starts_at'], 0, 10)         : '';
            $data['ends_at']           = $data['ends_at']           ? substr($data['ends_at'], 0, 10)           : '';
            $data['next_billing_date'] = $data['next_billing_date'] ? substr($data['next_billing_date'], 0, 10) : '';
        }
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Suscripción no encontrada',
            'data'    => $data
        ];
    }

    function addSubscription() {
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $planId    = (int) ($_POST['plan_id'] ?? 0);
        $status    = $this->subStatusIn($_POST['status'] ?? 'trial');

        if ($companyId <= 0 || $planId <= 0) {
            return ['status' => 400, 'message' => 'Empresa y plan son obligatorios'];
        }
        if (!$this->qCompanyHasSubscription([$companyId])) {
            return ['status' => 400, 'message' => 'La empresa seleccionada no es válida'];
        }
        if (!$this->qPlanExists([$planId])) {
            return ['status' => 400, 'message' => 'El plan seleccionado no es válido'];
        }

        $ok = $this->qInsertSubscription([
            $companyId,
            $planId,
            $status,
            $this->dateOrNull($_POST['starts_at'] ?? ''),
            $this->dateOrNull($_POST['ends_at'] ?? ''),
            $this->dateOrNull($_POST['next_billing_date'] ?? ''),
            trim($_POST['external_reference'] ?? '') ?: null
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Suscripción creada correctamente' : 'No se pudo crear la suscripción'
        ];
    }

    function editSubscription() {
        $id        = (int) $_POST['id'];
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $planId    = (int) ($_POST['plan_id'] ?? 0);
        $status    = $this->subStatusIn($_POST['status'] ?? 'trial');

        if ($companyId <= 0 || $planId <= 0) {
            return ['status' => 400, 'message' => 'Empresa y plan son obligatorios'];
        }
        if (!$this->qSubscription([$id])) {
            return ['status' => 404, 'message' => 'Suscripción no encontrada'];
        }

        $ok = $this->qUpdateSubscription([
            $companyId,
            $planId,
            $status,
            $this->dateOrNull($_POST['starts_at'] ?? ''),
            $this->dateOrNull($_POST['ends_at'] ?? ''),
            $this->dateOrNull($_POST['next_billing_date'] ?? ''),
            trim($_POST['external_reference'] ?? '') ?: null,
            $id
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Suscripción actualizada correctamente' : 'No se pudo actualizar la suscripción'
        ];
    }

    function changeSubscriptionStatus() {
        $id = (int) $_POST['id'];
        if (!in_array($_POST['status'] ?? '', $this->subStatuses, true)) {
            return ['status' => 400, 'message' => 'Estado de suscripción no válido'];
        }
        if (!$this->qSubscription([$id])) {
            return ['status' => 404, 'message' => 'Suscripción no encontrada'];
        }

        $ok = $this->qSetSubscriptionStatus([$_POST['status'], $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Estado de la suscripción actualizado' : 'No se pudo actualizar el estado'
        ];
    }

    /* ===== Pagos (payment_history) ===== */

    function lsPayments() {
        $status = $this->paymentStatusIn($_POST['status'] ?? 'paid');
        $ls = $this->qPayments([$status]);

        $row = [];
        foreach ($ls as $p) {
            // El me-1 de "cambiar estado" depende de si el boton de factura la
            // sigue en la fila: si no hay factura, "cambiar estado" es el ultimo.
            $hasInvoice = !empty($p['invoice_url']);
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'payments.editPayment(' . $p['id'] . ')'
            ];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral', !$hasInvoice),
                'html'    => '<i class="icon-cog"></i>',
                'onclick' => "payments.changeStatus(" . $p['id'] . ", '" . $p['status'] . "')"
            ];
            if ($hasInvoice) {
                $a[] = [
                    'class'   => $this->actionBtnClass('neutral', true),
                    'html'    => '<i class="icon-link-ext"></i>',
                    'onclick' => "window.open('" . htmlspecialchars($p['invoice_url'], ENT_QUOTES) . "', '_blank')"
                ];
            }

            $amount = number_format((float) $p['amount'], 2) . ' ' . ($p['currency'] ?: '');
            $row[] = [
                'id'        => $p['id'],
                'Empresa'   => htmlspecialchars($p['company_name'] ?? '—'),
                'Monto'     => trim($amount),
                'Pasarela'  => $p['gateway'] ?: '-',
                'Transacción' => $p['transaction_id'] ?: '-',
                'Pagado'    => $p['paid'] ?: '-',
                'Estado'    => renderPaymentStatus($p['status']),
                'a'         => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getPayment() {
        $data = $this->qPayment([(int) $_POST['id']]);
        if ($data) {
            $data['company_id']      = (string) $data['company_id'];
            $data['subscription_id'] = $data['subscription_id'] !== null ? (string) $data['subscription_id'] : '';
            $data['paid_at']         = $data['paid_at'] ? substr($data['paid_at'], 0, 10) : '';
        }
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Pago no encontrado',
            'data'    => $data
        ];
    }

    function addPayment() {
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $amount    = (float) ($_POST['amount'] ?? 0);
        if ($companyId <= 0) {
            return ['status' => 400, 'message' => 'La empresa es obligatoria'];
        }
        if ($amount <= 0) {
            return ['status' => 400, 'message' => 'El monto debe ser mayor a 0'];
        }
        if (!$this->qCompanyHasSubscription([$companyId])) {
            return ['status' => 400, 'message' => 'La empresa seleccionada no es válida'];
        }
        $status = $this->paymentStatusIn($_POST['status'] ?? 'pending');

        $ok = $this->qInsertPayment([
            $companyId,
            $this->selectOrNull($_POST['subscription_id'] ?? ''),
            $amount,
            trim($_POST['currency'] ?? '') ?: 'MXN',
            $status,
            trim($_POST['gateway'] ?? '') ?: null,
            $this->intOrNull($_POST['transaction_id'] ?? ''),
            $this->dateOrNull($_POST['paid_at'] ?? ''),
            trim($_POST['invoice_url'] ?? '') ?: null
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Pago registrado correctamente' : 'No se pudo registrar el pago'
        ];
    }

    function editPayment() {
        $id        = (int) $_POST['id'];
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $amount    = (float) ($_POST['amount'] ?? 0);
        if ($companyId <= 0) {
            return ['status' => 400, 'message' => 'La empresa es obligatoria'];
        }
        if ($amount <= 0) {
            return ['status' => 400, 'message' => 'El monto debe ser mayor a 0'];
        }
        if (!$this->qPayment([$id])) {
            return ['status' => 404, 'message' => 'Pago no encontrado'];
        }
        $status = $this->paymentStatusIn($_POST['status'] ?? 'pending');

        $ok = $this->qUpdatePayment([
            $companyId,
            $this->selectOrNull($_POST['subscription_id'] ?? ''),
            $amount,
            trim($_POST['currency'] ?? '') ?: 'MXN',
            $status,
            trim($_POST['gateway'] ?? '') ?: null,
            $this->intOrNull($_POST['transaction_id'] ?? ''),
            $this->dateOrNull($_POST['paid_at'] ?? ''),
            trim($_POST['invoice_url'] ?? '') ?: null,
            $id
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Pago actualizado correctamente' : 'No se pudo actualizar el pago'
        ];
    }

    function changePaymentStatus() {
        $id = (int) $_POST['id'];
        if (!in_array($_POST['status'] ?? '', $this->paymentStatuses, true)) {
            return ['status' => 400, 'message' => 'Estado de pago no válido'];
        }
        if (!$this->qPayment([$id])) {
            return ['status' => 404, 'message' => 'Pago no encontrado'];
        }

        $ok = $this->qSetPaymentStatus([$_POST['status'], $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Estado del pago actualizado' : 'No se pudo actualizar el estado'
        ];
    }

    /* ===== Cupones (coupons) ===== */

    function lsCoupons() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qCoupons([$active]);

        $row = [];
        foreach ($ls as $c) {
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'coupons.editCoupon(' . $c['id'] . ')'
            ];
            if ($c['is_active'] == 1) {
                $a[] = [
                    'class'   => $this->actionBtnClass('danger', true),
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'coupons.toggleCoupon(' . $c['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => $this->actionBtnClass('neutral', true),
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'coupons.toggleCoupon(' . $c['id'] . ', 1)'
                ];
            }

            $row[] = [
                'id'         => $c['id'],
                'Código'     => htmlspecialchars($c['code'] ?? ''),
                'Descripción'=> $c['description'] ? htmlspecialchars($c['description']) : '-',
                'Descuento'  => renderDiscount($c['discount_type'], $c['discount_value']),
                'Usos'       => ($c['times_redeemed'] ?? 0) . ' / ' . ($c['max_redemptions'] ?? '∞'),
                'Vigencia'   => ($c['valid_from'] ?: '—') . ' → ' . ($c['valid_to'] ?: '—'),
                'Estado'     => renderActive($c['is_active']),
                'a'          => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getCoupon() {
        $data = $this->qCoupon([(int) $_POST['id']]);
        if ($data) {
            $data['valid_from'] = $data['valid_from'] ? substr($data['valid_from'], 0, 10) : '';
            $data['valid_to']   = $data['valid_to']   ? substr($data['valid_to'], 0, 10)   : '';
        }
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Cupón no encontrado',
            'data'    => $data
        ];
    }

    function addCoupon() {
        $code = trim($_POST['code'] ?? '');
        if ($code === '') {
            return ['status' => 400, 'message' => 'El código del cupón es obligatorio'];
        }
        if ($this->qCodeExists([$code])) {
            return ['status' => 409, 'message' => 'Ya existe un cupón con ese código'];
        }
        $type = in_array($_POST['discount_type'] ?? '', $this->discountTypes, true)
            ? $_POST['discount_type'] : 'percent';

        $ok = $this->qInsertCoupon([
            $code,
            trim($_POST['description'] ?? '') ?: null,
            $type,
            (int) ($_POST['discount_value'] ?? 0),
            $this->intOrNull($_POST['max_redemptions'] ?? '') ?? 1,
            $this->dateOrNull($_POST['valid_from'] ?? ''),
            $this->dateOrNull($_POST['valid_to'] ?? '')
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Cupón creado correctamente' : 'No se pudo crear el cupón'
        ];
    }

    function editCoupon() {
        $id   = (int) $_POST['id'];
        $code = trim($_POST['code'] ?? '');
        if ($code === '') {
            return ['status' => 400, 'message' => 'El código del cupón es obligatorio'];
        }
        if (!$this->qCoupon([$id])) {
            return ['status' => 404, 'message' => 'Cupón no encontrado'];
        }
        if ($this->qCodeExistsExcept([$code, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro cupón con ese código'];
        }
        $type = in_array($_POST['discount_type'] ?? '', $this->discountTypes, true)
            ? $_POST['discount_type'] : 'percent';

        $ok = $this->qUpdateCoupon([
            $code,
            trim($_POST['description'] ?? '') ?: null,
            $type,
            (int) ($_POST['discount_value'] ?? 0),
            $this->intOrNull($_POST['max_redemptions'] ?? '') ?? 1,
            $this->dateOrNull($_POST['valid_from'] ?? ''),
            $this->dateOrNull($_POST['valid_to'] ?? ''),
            $id
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Cupón actualizado correctamente' : 'No se pudo actualizar el cupón'
        ];
    }

    function toggleCoupon() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];
        if (!$this->qCoupon([$id])) {
            return ['status' => 404, 'message' => 'Cupón no encontrado'];
        }

        $ok = $this->qSetCouponActive([$active, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Cupón activado' : 'Cupón desactivado') : 'No se pudo actualizar el estado'
        ];
    }

    /* ===== Canjes de cupón (coupon_redemptions) ===== */

    function lsRedemptions() {
        $ls = $this->qRedemptions([]);

        $row = [];
        foreach ($ls as $r) {
            $row[] = [
                'id'          => $r['id'],
                'Cupón'       => $r['coupon_code'] ? htmlspecialchars($r['coupon_code']) : '—',
                'Empresa'     => htmlspecialchars($r['company_name'] ?? '—'),
                'Suscripción' => $r['subscription_id'] ? '#' . $r['subscription_id'] : '-',
                'Canjeado'    => $r['redeemed'] ?: '-'
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }
}

Permission::dispatch(new ctrl(), 'facturacion');
