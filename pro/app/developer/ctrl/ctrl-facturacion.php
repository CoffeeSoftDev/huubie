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
            'modulesModes'              => [
                ['id' => 'included', 'valor' => 'Los módulos que elijas abajo'],
                ['id' => 'all',      'valor' => 'Todos los módulos'],
                ['id' => 'custom',   'valor' => 'Personalizado: la empresa elige y paga por módulo']
            ],
            // Los que se venden, con su precio mensual (plan Personalizado).
            'sellModules'               => $this->qSellableModules(),
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

            $price = $p['modules_mode'] === 'custom'
                ? 'Por módulo'
                : number_format((float) $p['price'], 2) . ' ' . ($p['currency'] ?: '');
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

        // Las tarjetas leen ls: lo que incluye como lista y los módulos como ids.
        $ls = array_map(function ($p) {
            $p['features']   = $this->planFeatures($p['features']);
            $p['module_ids'] = $p['module_ids'] ? array_map('intval', explode(',', $p['module_ids'])) : [];
            return $p;
        }, $ls);

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getPlan() {
        $data = $this->qPlan([(int) $_POST['id']]);
        if ($data) {
            // El textarea lleva lo que incluye un renglón por punto.
            $data['features']   = implode("\n", $this->planFeatures($data['features']));
            $data['module_ids'] = $this->qPlanModuleIds([(int) $data['id']]);
        }
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Plan no encontrado',
            'data'    => $data
        ];
    }

    function addPlan() {
        $input = $this->planInput();
        if (isset($input['error'])) return ['status' => 400, 'message' => $input['error']];

        return $this->saveInTransaction(function () use ($input) {
            if (!$this->qInsertPlan($input['values'])) throw new \Exception('insert');

            $id = $this->qLastInsertId();
            if (!$id) throw new \Exception('No se pudo obtener el id del plan creado');
            $this->syncPlanModules($id, $input['modules']);

            return ['status' => 200, 'message' => 'Plan creado correctamente'];
        }, 'No se pudo crear el plan');
    }

    function editPlan() {
        $id = (int) $_POST['id'];
        if (!$this->qPlan([$id])) {
            return ['status' => 404, 'message' => 'Plan no encontrado'];
        }
        $input = $this->planInput();
        if (isset($input['error'])) return ['status' => 400, 'message' => $input['error']];

        return $this->saveInTransaction(function () use ($id, $input) {
            if (!$this->qUpdatePlan(array_merge($input['values'], [$id]))) throw new \Exception('update');
            $this->syncPlanModules($id, $input['modules']);

            return ['status' => 200, 'message' => 'Plan actualizado correctamente'];
        }, 'No se pudo actualizar el plan');
    }

    /*  Lo que llega del formulario del plan, ya validado.
        modules_mode: 'included' trae los módulos elegidos (module_ids, al menos
        uno), 'all' todos los que se venden y 'custom' los que elija cada empresa;
        este último no tiene precio fijo: se cobra la suma de sus módulos. */
    private function planInput() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['error' => 'El nombre del plan es obligatorio'];

        $mode  = in_array($_POST['modules_mode'] ?? '', $this->modulesModes, true) ? $_POST['modules_mode'] : 'included';
        $cycle = in_array($_POST['billing_cycle'] ?? '', $this->billingCycles, true) ? $_POST['billing_cycle'] : 'monthly';

        $modules = $mode === 'included' ? $this->sellableIds($this->postedIds('module_ids')) : [];
        if ($mode === 'included' && !$modules) return ['error' => 'Elige al menos un módulo del plan'];

        $features = array_values(array_filter(array_map('trim', preg_split('/\R/', (string) ($_POST['features'] ?? '')))));

        return [
            'modules' => $modules,
            'values'  => [
                trim($_POST['code'] ?? '') ?: null,
                $name,
                $mode === 'custom' ? null : round((float) ($_POST['price'] ?? 0), 2),
                $this->moneyOrNull($_POST['price_before'] ?? ''),
                trim($_POST['currency'] ?? '') ?: 'MXN',
                $cycle,
                $this->intOrNull($_POST['max_users'] ?? ''),
                $this->intOrNull($_POST['max_branches'] ?? ''),
                $this->intOrNull($_POST['trial_days'] ?? ''),
                $features ? json_encode($features, JSON_UNESCAPED_UNICODE) : null,
                $mode
            ]
        ];
    }

    // plan_module queda con exactamente esos módulos (vacío en 'all' y 'custom').
    private function syncPlanModules($planId, $moduleIds) {
        $this->qDeletePlanModules([$planId]);
        foreach ($moduleIds as $moduleId) {
            if (!$this->qInsertPlanModule([$planId, $moduleId])) throw new \Exception('plan_module');
        }
    }

    // plans.features es un JSON con la lista de lo que incluye el plan.
    private function planFeatures($json) {
        $list = json_decode((string) $json, true);
        return is_array($list) ? array_values(array_filter($list, 'is_string')) : [];
    }

    // Solo los que se venden: Developer y los apagados no entran en un plan.
    private function sellableIds($ids) {
        $sellable = array_map('intval', array_column($this->qSellableModules(), 'id'));
        return array_values(array_intersect($ids, $sellable));
    }

    // La transacción relanza el error y el dispatcher no lo atrapa: aquí se
    // vuelve una respuesta 500 en vez de una página de error de PHP.
    private function saveInTransaction(callable $fn, $errorMessage) {
        try {
            return $this->transaction($fn);
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => $errorMessage];
        }
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

            // Personalizado: sus módulos debajo del plan y el precio es su suma.
            $custom = $s['modules_mode'] === 'custom';
            $plan   = htmlspecialchars($s['plan_name'] ?? '—');
            if ($custom) {
                $plan .= '<p class="text-[11px] text-gray-400 mb-0">' . htmlspecialchars($s['module_names'] ?: 'Sin módulos elegidos') . '</p>';
            }
            $price = $custom ? $s['modules_price'] : $s['plan_price'];

            $row[] = [
                'id'        => $s['id'],
                'Empresa'   => htmlspecialchars($s['company_name'] ?? '—'),
                'Plan'      => $plan,
                'Precio'    => $price !== null ? '$' . number_format((float) $price, 2) . ' ' . ($s['currency'] ?: 'MXN') : '—',
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
            // Personalizado: los módulos elegidos y el precio con el que se contrató cada uno.
            $data['modules'] = array_map(function ($m) {
                return ['id' => (int) $m['module_id'], 'price' => (float) $m['price']];
            }, $this->qSubscriptionModules([(int) $data['id']]));
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
        $plan = $this->qPlan([$planId]);
        if (!$plan) {
            return ['status' => 400, 'message' => 'El plan seleccionado no es válido'];
        }
        $modules = $this->subscriptionModulesInput($plan);
        if (isset($modules['error'])) return ['status' => 400, 'message' => $modules['error']];

        return $this->saveInTransaction(function () use ($companyId, $planId, $status, $modules) {
            $ok = $this->qInsertSubscription([
                $companyId,
                $planId,
                $status,
                $this->dateOrNull($_POST['starts_at'] ?? ''),
                $this->dateOrNull($_POST['ends_at'] ?? ''),
                $this->dateOrNull($_POST['next_billing_date'] ?? ''),
                trim($_POST['external_reference'] ?? '') ?: null
            ]);
            if (!$ok) throw new \Exception('insert');

            $id = $this->qLastInsertId();
            if (!$id) throw new \Exception('No se pudo obtener el id de la suscripción creada');
            $this->syncSubscriptionModules($id, $modules['prices']);

            return ['status' => 200, 'message' => 'Suscripción creada correctamente'];
        }, 'No se pudo crear la suscripción');
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
        $plan = $this->qPlan([$planId]);
        if (!$plan) {
            return ['status' => 400, 'message' => 'El plan seleccionado no es válido'];
        }

        // Los módulos que ya tenía conservan el precio con el que se contrataron.
        $kept = [];
        foreach ($this->qSubscriptionModules([$id]) as $m) $kept[(int) $m['module_id']] = (float) $m['price'];

        $modules = $this->subscriptionModulesInput($plan, $kept);
        if (isset($modules['error'])) return ['status' => 400, 'message' => $modules['error']];

        return $this->saveInTransaction(function () use ($id, $companyId, $planId, $status, $modules) {
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
            if (!$ok) throw new \Exception('update');
            $this->syncSubscriptionModules($id, $modules['prices']);

            return ['status' => 200, 'message' => 'Suscripción actualizada correctamente'];
        }, 'No se pudo actualizar la suscripción');
    }

    /*  Los módulos de una suscripción a un plan Personalizado (module_ids), con
        el precio que se le cobra por cada uno: el que ya tenía contratado o, si es
        nuevo, el precio actual del módulo. Otro tipo de plan no guarda módulos.
        prices: [module_id => precio]. */
    private function subscriptionModulesInput($plan, $kept = []) {
        if ($plan['modules_mode'] !== 'custom') return ['prices' => []];

        $catalog = [];
        foreach ($this->qSellableModules() as $m) $catalog[(int) $m['id']] = $m;

        $prices = [];
        foreach ($this->postedIds('module_ids') as $moduleId) {
            if (isset($kept[$moduleId])) {
                $prices[$moduleId] = $kept[$moduleId];
                continue;
            }
            if (!isset($catalog[$moduleId])) continue;
            if ($catalog[$moduleId]['price'] === null) {
                return ['error' => 'El módulo ' . $catalog[$moduleId]['valor'] . ' no tiene precio. Ponlo en Accesos › Módulos.'];
            }
            $prices[$moduleId] = (float) $catalog[$moduleId]['price'];
        }

        if (!$prices) return ['error' => 'El plan ' . $plan['name'] . ' se arma por módulos: elige al menos uno'];
        return ['prices' => $prices];
    }

    private function syncSubscriptionModules($subscriptionId, $prices) {
        $this->qDeleteSubscriptionModules([$subscriptionId]);
        foreach ($prices as $moduleId => $price) {
            if (!$this->qInsertSubscriptionModule([$subscriptionId, $moduleId, $price])) throw new \Exception('subscription_module');
        }
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

    /* ===== Empresas: la cartera de clientes vista por el developer =====
       Todo lo de cada empresa: plan vigente, consumo, sucursales, usuarios,
       módulos, pagos e historial (pestaña Empresas). Pagos usa lsPanelPayments. */

    // Listado: una fila por empresa con su plan vigente, su consumo y su cobranza.
    function lsCompanyPanel() {
        $subs   = $this->groupBy($this->qPanelSubscriptions([0, 0]), 'company_id');
        $totals = [];
        foreach ($this->qPanelPaymentTotals() as $t) $totals[$t['company_id']] = $t;

        $rows = [];
        foreach ($this->qPanelCompanies([0, 0]) as $c) {
            $id  = (int) $c['id'];
            $t   = $totals[$id] ?? null;

            $rows[] = array_merge($this->companySummary($c, $this->currentSubscription($subs[$id] ?? [])), [
                'paid_total'    => $t ? (float) $t['paid_total'] : 0,
                'pending_total' => $t ? (float) $t['pending_total'] : 0,
                'last_paid'     => $t ? $t['last_paid'] : null
            ]);
        }

        return ['status' => 200, 'companies' => $rows, 'plans' => $this->qPlansForSelect()];
    }

    // Detalle de una empresa: todo lo que se puede rescatar de ella.
    function getCompanyPanel() {
        $id       = (int) ($_POST['id'] ?? 0);
        $found    = $this->qPanelCompanies([$id, $id]);
        $company  = $id > 0 && $found ? $found[0] : null;
        if (!$company) return ['status' => 404, 'message' => 'Empresa no encontrada'];

        $subs    = $this->qPanelSubscriptions([$id, $id]);
        $current = $this->currentSubscription($subs);

        // Usuarios de la empresa con sus accesos. root entra a todas las sucursales
        // sin ser de la empresa: no cuenta en los usuarios por sucursal.
        $access = $this->groupBy($this->qPanelAccess([$id]), 'user_id');
        $users  = [];
        foreach ($this->qPanelUsers([$id]) as $u) {
            $users[] = [
                'id'            => (int) $u['id'],
                'name'          => trim($u['name'] . ' ' . ($u['last_name'] ?? '')),
                'email'         => $u['email'] ?: '',
                'status'        => $u['status'],
                'is_owner'      => (int) $u['is_owner'] === 1,
                'color'         => $u['color'] ?: '',
                'branch_id'     => (int) $u['branch_id'],
                'last_activity' => $u['last_activity'],
                'access'        => array_map(function ($a) {
                    return [
                        'branch_id'   => (int) $a['branch_id'],
                        'branch_name' => $a['branch_name'],
                        'role_name'   => $a['role_name'] ?: 'Sin rol'
                    ];
                }, $access[$u['id']] ?? [])
            ];
        }

        $branches = array_map(function ($b) use ($users) {
            $id = (int) $b['id'];
            return [
                'id'        => $id,
                'name'      => $b['name'],
                'ubication' => $b['ubication'] ?: '',
                'is_active' => (int) $b['is_active'],
                'created'   => $b['created'],
                // Con acceso (users_braches) y los que pertenecen a ella (users.branch_id).
                'users'     => count(array_filter($users, function ($u) use ($id) {
                    return in_array($id, array_column($u['access'], 'branch_id'), true);
                })),
                'home'      => count(array_filter($users, function ($u) use ($id) { return $u['branch_id'] === $id; }))
            ];
        }, $this->qBranches([$id]));

        // Pagados: los del plan vigente (ver paidModules). En uso: los que sus roles abren.
        $catalog = $this->qModulesCatalog();
        $inPlan  = $this->contracted($current) ? $this->paidModules($current, $this->moduleSources($catalog)) : [];
        $enabled = [];
        foreach ($this->qPanelEnabledModules([$id, $id]) as $m) $enabled[(int) $m['module_id']] = (int) $m['sections'];

        $modules = array_map(function ($m) use ($inPlan, $enabled) {
            return [
                'id'          => (int) $m['id'],
                'name'        => $m['name'],
                'icon'        => $m['icon'] ?: 'layout-grid',
                'description' => $m['description'] ?: '',
                'is_active'   => (int) $m['is_active'],
                'in_plan'     => in_array((int) $m['id'], $inPlan, true),
                'sections'    => $enabled[(int) $m['id']] ?? 0
            ];
        }, $catalog);

        return [
            'status'        => 200,
            'company'       => array_merge($this->companySummary($company, $current), ['database' => $company['database_name'] ?: '']),
            'branches'      => $branches,
            'users'         => $users,
            'modules'       => $modules,
            'payments'      => array_map(function ($p) { return $this->paymentRow($p); }, $this->qPanelPayments([$id, $id])),
            'subscriptions' => array_map(function ($s) { return $this->subscriptionRow($s); }, $subs),
            'redemptions'   => $this->qPanelRedemptions([$id])
        ];
    }

    // Pagos de todas las empresas, para la vista Pagos del panel.
    function lsPanelPayments() {
        return [
            'status'   => 200,
            'payments' => array_map(function ($p) { return $this->paymentRow($p); }, $this->qPanelPayments([0, 0]))
        ];
    }

    /* ===== Módulos: su facturación =====
       Cada módulo que se vende (Developer no): su precio en el plan
       Personalizado, qué ofrece, en qué planes viene, qué empresas lo pagan y
       cuáles lo usan, y lo que deja al mes por suscripciones Personalizado.
       "Qué ofrece" (modules.features) llega con la migración
       2026-10-31_modulos-que-ofrece.sql: sin ella todo funciona menos esa lista
       (hasFeatures avisa al front). */

    function lsBillingModules() {
        $catalog = $this->qModulesBilling();
        $sources = $this->moduleSources($catalog);

        // Los módulos que paga cada empresa con su suscripción vigente.
        $paidBy = [];
        foreach ($this->groupBy($this->qPanelSubscriptions([0, 0]), 'company_id') as $companyId => $list) {
            $current = $this->currentSubscription($list);
            if ($this->contracted($current)) $paidBy[(int) $companyId] = $this->paidModules($current, $sources);
        }

        $used    = $this->groupBy($this->qPanelEnabledModules([0, 0]), 'module_id');
        $revenue = [];
        foreach ($this->qCustomModuleRevenue() as $r) $revenue[(int) $r['module_id']] = $r;
        $names   = [];
        foreach ($this->qPanelCompanies([0, 0]) as $c) $names[(int) $c['id']] = $c['name'];
        $plans   = $this->qPlans([1]);

        $modules = [];
        foreach ($catalog as $m) {
            if ($m['code'] === 'developer') continue;
            $id = (int) $m['id'];

            $paying = [];
            foreach ($paidBy as $companyId => $moduleIds) {
                if (in_array($id, $moduleIds, true)) $paying[] = $names[$companyId] ?? ('#' . $companyId);
            }
            $using = array_map(function ($u) use ($names) {
                return $names[(int) $u['company_id']] ?? ('#' . $u['company_id']);
            }, $used[$id] ?? []);

            // Los planes activos que lo traen; el Personalizado, si tiene precio para elegirlo.
            $inPlans = [];
            foreach ($plans as $p) {
                $ids = $p['module_ids'] ? array_map('intval', explode(',', $p['module_ids'])) : [];
                if ($p['modules_mode'] === 'all'
                    || ($p['modules_mode'] === 'included' && in_array($id, $ids, true))
                    || ($p['modules_mode'] === 'custom' && $m['price'] !== null)) {
                    $inPlans[] = $p['name'];
                }
            }

            $modules[] = [
                'id'          => $id,
                'name'        => $m['name'],
                'icon'        => $m['icon'] ?: 'layout-grid',
                'description' => $m['description'] ?: '',
                'price'       => $m['price'] !== null ? (float) $m['price'] : null,
                'features'    => $this->planFeatures($m['features'] ?? null),
                'is_active'   => (int) $m['is_active'],
                'plans'       => $inPlans,
                'paying'      => $paying,
                'using'       => array_values($using),
                'revenue'     => isset($revenue[$id]) ? (float) $revenue[$id]['total'] : 0,
                'custom_subs' => isset($revenue[$id]) ? (int) $revenue[$id]['subs'] : 0
            ];
        }

        return [
            'status'      => 200,
            'modules'     => $modules,
            'companies'   => count($names),
            'hasFeatures' => $this->qModulesHaveFeatures()
        ];
    }

    // Lo que se cobra del módulo; nombre, ícono y ruta se editan en Accesos › Módulos.
    // Sin precio no se puede elegir en un Personalizado; lo ya contratado conserva el suyo.
    function editModuleBilling() {
        $id     = (int) ($_POST['id'] ?? 0);
        $module = $this->qModule([$id]);
        if (!$module) return ['status' => 404, 'message' => 'Módulo no encontrado'];
        if ($module['code'] === 'developer') {
            return ['status' => 400, 'message' => 'Developer no se vende: es la administración de la plataforma'];
        }

        $price = $this->moneyOrNull($_POST['price'] ?? '');
        if ($price !== null && $price < 0) return ['status' => 400, 'message' => 'El precio no puede ser negativo'];

        $features = array_values(array_filter(array_map('trim', preg_split('/\R/', (string) ($_POST['features'] ?? '')))));

        return $this->saveInTransaction(function () use ($id, $price, $features) {
            if (!$this->qUpdateModuleBilling([$price, trim($_POST['description'] ?? '') ?: null, $id])) throw new \Exception('update');
            if (isset($_POST['features']) && $this->qModulesHaveFeatures()) {
                $json = $features ? json_encode($features, JSON_UNESCAPED_UNICODE) : null;
                if (!$this->qUpdateModuleFeatures([$json, $id])) throw new \Exception('features');
            }
            return ['status' => 200, 'message' => 'Módulo actualizado correctamente'];
        }, 'No se pudo actualizar el módulo');
    }

    /*  Los módulos que paga una suscripción, según el modo de su plan:
        included  los del plan (plan_module)
        all       todos los que se venden (encendidos y sin Developer)
        custom    los que eligió la empresa (subscription_module) */
    private function paidModules($sub, $sources) {
        switch ($sub['modules_mode'] ?? 'included') {
            case 'all':    return $sources['sellable'];
            case 'custom': return array_map('intval', array_column($sources['bySubscription'][$sub['id']] ?? [], 'module_id'));
            default:       return array_map('intval', array_column($sources['byPlan'][$sub['plan_id']] ?? [], 'module_id'));
        }
    }

    // Lo que necesita paidModules, leído una sola vez para todas las empresas.
    private function moduleSources($catalog) {
        $sellable = [];
        foreach ($catalog as $m) {
            if ((int) $m['is_active'] === 1 && $m['code'] !== 'developer') $sellable[] = (int) $m['id'];
        }
        return [
            'sellable'       => $sellable,
            'byPlan'         => $this->groupBy($this->qPlanModulesAll(), 'plan_id'),
            'bySubscription' => $this->groupBy($this->qSubscriptionModulesAll(), 'subscription_id')
        ];
    }

    // Lo que cuesta la suscripción: el precio del plan o, en un Personalizado,
    // la suma de los módulos que eligió. null si el plan ya no existe.
    private function subscriptionPrice($sub) {
        if (($sub['modules_mode'] ?? '') === 'custom') return (float) ($sub['modules_price'] ?? 0);
        return $sub['price'] !== null ? (float) $sub['price'] : null;
    }

    // La suscripción que manda: la más nueva activa o en prueba; si no hay, la
    // última que tuvo (vencida o cancelada), para decir cómo terminó.
    private function currentSubscription($list) {
        foreach ($list as $s) {
            if (in_array($s['status'], ['active', 'trial'], true)) return $s;
        }
        return $list ? $list[0] : null;
    }

    // Sigue contratada aunque deba un pago; cancelada o expirada ya no incluye módulos.
    private function contracted($sub) {
        return $sub && in_array($sub['status'], ['active', 'trial', 'past_due'], true);
    }

    private function companySummary($c, $sub) {
        $plan = $sub && $sub['plan_name'] !== null ? [
            'id'           => (int) $sub['plan_id'],
            'name'         => $sub['plan_name'],
            'price'        => (float) $this->subscriptionPrice($sub),
            'mode'         => $sub['modules_mode'],
            'currency'     => $sub['currency'] ?: 'MXN',
            'cycle'        => $sub['billing_cycle'],
            'max_users'    => $sub['max_users'] !== null ? (int) $sub['max_users'] : null,
            'max_branches' => $sub['max_branches'] !== null ? (int) $sub['max_branches'] : null
        ] : null;

        return [
            'id'              => (int) $c['id'],
            'name'            => $c['name'],
            'rfc'             => $c['rfc'] ?: '',
            'ubication'       => $c['ubication'] ?: '',
            'status'          => $c['status'],
            'created'         => $c['created'],
            'branches'        => (int) $c['branches'],
            'branches_active' => (int) $c['branches_active'],
            'users'           => (int) $c['users'],
            'users_active'    => (int) $c['users_active'],
            'owners'          => $c['owners'] ?: '',
            'plan'            => $plan,
            'subscription'    => $sub ? $this->subscriptionRow($sub) : null,
            'monthly'         => $this->monthlyAmount($sub),
            'state'           => $this->companyState($c, $sub)
        ];
    }

    // Lo que paga al mes: anual entre 12; de por vida y en prueba no cuentan.
    private function monthlyAmount($sub) {
        $price = $sub ? $this->subscriptionPrice($sub) : null;
        if (!$sub || $sub['status'] !== 'active' || $price === null) return 0;
        if ($sub['billing_cycle'] === 'yearly') return round($price / 12, 2);
        if ($sub['billing_cycle'] === 'lifetime') return 0;
        return $price;
    }

    /*  El estado que ve el developer: primero el de la empresa (suspendida o
        cancelada manda), luego el de su suscripción y cuánto le falta para vencer.
        days: días para el fin de la vigencia o el siguiente cobro. */
    private function companyState($c, $sub) {
        $state = function ($key, $label, $tone, $days = null) {
            return ['key' => $key, 'label' => $label, 'tone' => $tone, 'days' => $days];
        };

        if ($c['status'] === 'suspended') return $state('suspendida', 'Suspendida', 'bad');
        if ($c['status'] === 'cancelled') return $state('suspendida', 'Cancelada', 'bad');
        if (!$sub) return $state('sin_plan', 'Sin plan', 'neutral');

        $end  = $sub['ends'] ?: $sub['next_billing'];
        $days = $end ? (int) floor((strtotime($end) - strtotime(date('Y-m-d'))) / 86400) : null;

        $closed = ['past_due' => 'Pago vencido', 'expired' => 'Expirada', 'cancelled' => 'Cancelada'];
        if (isset($closed[$sub['status']])) return $state('vencida', $closed[$sub['status']], 'bad', $days);
        if ($days !== null && $days < 0) return $state('vencida', 'Vencida', 'bad', $days);
        if ($sub['status'] === 'trial') return $state('activa', 'En prueba', 'info', $days);
        if ($days !== null && $days <= 15) return $state('por_vencer', 'Por vencer', 'warn', $days);
        if ($c['status'] === 'pending') return $state('activa', 'Pendiente', 'warn', $days);
        return $state('activa', 'Activa', 'ok', $days);
    }

    private function subscriptionRow($s) {
        return [
            'id'           => (int) $s['id'],
            'plan'         => $s['plan_name'] ?: 'Plan eliminado',
            'status'       => $s['status'],
            'starts'       => $s['starts'],
            'ends'         => $s['ends'],
            'next_billing' => $s['next_billing'],
            'created'      => $s['created'],
            'reference'    => $s['external_reference'] ?: '',
            'price'        => $this->subscriptionPrice($s),
            'currency'     => $s['currency'] ?: 'MXN',
            'cycle'        => $s['billing_cycle']
        ];
    }

    private function paymentRow($p) {
        return [
            'id'         => (int) $p['id'],
            'company_id' => (int) $p['company_id'],
            'company'    => $p['company_name'] ?: '',
            'amount'     => (float) $p['amount'],
            'currency'   => $p['currency'] ?: 'MXN',
            'status'     => $p['status'],
            'gateway'    => $p['gateway'] ?: '',
            'reference'  => $p['transaction_id'] ? (string) $p['transaction_id'] : '',
            'date'       => $p['paid'] ?: $p['created'],
            'paid'       => $p['paid'],
            'invoice'    => $p['invoice_url'] ?: '',
            'plan'       => $p['plan_name'] ?: ''
        ];
    }

    private function groupBy($rows, $key) {
        $out = [];
        foreach ($rows as $r) $out[$r[$key]][] = $r;
        return $out;
    }

    /* ===== Sucursales de una empresa (desde su detalle en Empresas) ===== */

    function addBranch() {
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $name      = trim($_POST['name'] ?? '');

        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }
        if (!$this->qCompanyHasSubscription([$companyId])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }
        if ($this->qBranchNameExists([$name, $companyId])) {
            return ['status' => 400, 'message' => 'Ya existe una sucursal con ese nombre'];
        }

        $error = $this->branchLimitError($companyId);
        if ($error) return ['status' => 400, 'message' => $error];

        $ok = $this->qInsertBranch([$name, trim($_POST['ubication'] ?? '') ?: null, $companyId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal «' . $name . '» creada correctamente' : 'No se pudo crear la sucursal'
        ];
    }

    function editBranch() {
        $id   = (int) ($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');

        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }
        $branch = $this->qBranch([$id]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }
        if ($this->qBranchNameExistsExcept([$name, (int) $branch['company_id'], $id])) {
            return ['status' => 400, 'message' => 'Ya existe una sucursal con ese nombre'];
        }

        $ok = $this->qUpdateBranch([$name, trim($_POST['ubication'] ?? '') ?: null, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal actualizada' : 'No se pudo actualizar la sucursal'
        ];
    }

    // Desactivar no borra la gente: las asignaciones quedan guardadas para cuando
    // se reactive. Reactivar respeta el límite del plan, igual que dar de alta.
    function toggleBranch() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        $branch = $this->qBranch([$id]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }
        if ($active && (int) $branch['is_active'] !== 1) {
            $error = $this->branchLimitError((int) $branch['company_id']);
            if ($error) return ['status' => 400, 'message' => $error];
        }

        $ok = $this->qSetBranchActive([$active, $id]);
        if (!$ok) {
            return ['status' => 500, 'message' => 'No se pudo actualizar el estado'];
        }
        if ($active) {
            return ['status' => 200, 'message' => 'Sucursal «' . $branch['name'] . '» activada'];
        }

        $kept = $this->qCountBranchAssignments([$id]);
        return [
            'status'  => 200,
            'message' => $kept > 0
                ? 'Sucursal desactivada. ' . $kept . ' asignaciones quedan guardadas.'
                : 'Sucursal desactivada'
        ];
    }

    // null si el plan vigente admite otra sucursal activa (o no tiene tope).
    private function branchLimitError($companyId) {
        $plan = $this->qPlanActiveByCompany([$companyId]);
        if ($plan && $plan['max_branches'] !== null
            && $this->qCountActiveBranches([$companyId]) >= (int) $plan['max_branches']) {
            return 'El plan ' . $plan['name'] . ' permite ' . (int) $plan['max_branches'] . ' sucursales activas';
        }
        return null;
    }
}

Permission::dispatch(new ctrl(), 'facturacion');
