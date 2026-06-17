<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-tenant.php';

// Controlador del Administrador del Tenant: super-admin global.
class ctrl extends mdl {

    /* Valores de enum válidos por entidad (whitelist). */
    private $companyStatuses = ['pending', 'active', 'suspendend', 'cancelled'];
    private $subStatuses      = ['trial', 'active', 'past_due', 'cancelled', 'expired'];
    private $billingCycles    = ['monthly', 'yearly', 'lifetime'];
    private $paymentStatuses  = ['paid', 'pending', 'failed', 'refunded'];
    private $discountTypes    = ['percent', 'fixed'];

    public function __construct() {
        parent::__construct();
    }

    function init() {
        return [
            'status'                 => 200,
            // Filtro genérico activo/inactivo (planes).
            'statusFilter'           => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'companyStatusFilter'    => [
                ['id' => 'active',     'valor' => 'Activas'],
                ['id' => 'pending',    'valor' => 'Pendientes'],
                ['id' => 'suspendend', 'valor' => 'Suspendidas'],
                ['id' => 'cancelled',  'valor' => 'Canceladas']
            ],
            'subscriptionStatusFilter' => [
                ['id' => 'active',   'valor' => 'Activas'],
                ['id' => 'trial',    'valor' => 'Prueba'],
                ['id' => 'past_due', 'valor' => 'Vencidas'],
                ['id' => 'cancelled','valor' => 'Canceladas'],
                ['id' => 'expired',  'valor' => 'Expiradas']
            ],
            'billingCycles'          => [
                ['id' => 'monthly',  'valor' => 'Mensual'],
                ['id' => 'yearly',   'valor' => 'Anual'],
                ['id' => 'lifetime', 'valor' => 'De por vida']
            ],
            'companyStatusOptions'   => [
                ['id' => 'pending',    'valor' => 'Pendiente'],
                ['id' => 'active',     'valor' => 'Activa'],
                ['id' => 'suspendend', 'valor' => 'Suspendida'],
                ['id' => 'cancelled',  'valor' => 'Cancelada']
            ],
            'subscriptionStatusOptions' => [
                ['id' => 'trial',    'valor' => 'Prueba'],
                ['id' => 'active',   'valor' => 'Activa'],
                ['id' => 'past_due', 'valor' => 'Vencida'],
                ['id' => 'cancelled','valor' => 'Cancelada'],
                ['id' => 'expired',  'valor' => 'Expirada']
            ],
            'paymentStatusFilter'    => [
                ['id' => 'paid',     'valor' => 'Pagados'],
                ['id' => 'pending',  'valor' => 'Pendientes'],
                ['id' => 'failed',   'valor' => 'Fallidos'],
                ['id' => 'refunded', 'valor' => 'Reembolsados']
            ],
            'paymentStatusOptions'   => [
                ['id' => 'pending',  'valor' => 'Pendiente'],
                ['id' => 'paid',     'valor' => 'Pagado'],
                ['id' => 'failed',   'valor' => 'Fallido'],
                ['id' => 'refunded', 'valor' => 'Reembolsado']
            ],
            'discountTypeOptions'    => [
                ['id' => 'percent', 'valor' => 'Porcentaje (%)'],
                ['id' => 'fixed',   'valor' => 'Monto fijo']
            ],
            'companies'              => $this->qCompaniesForSelect(),
            'plans'                  => $this->qPlansForSelect(),
            'subscriptions'          => $this->qSubscriptionsForSelect(),
            'modules'                => $this->qModulesForSelect(),
            'submodules'             => $this->qSubmodulesForSelect(),
            'sections'               => $this->qSectionsForSelect(),
            'roles'                  => $this->qRolesForSelect(),
            'typePermissions'        => $this->qTypePermissionsForSelect(),
            'branches'               => $this->qBranchesForSelect([$this->companyId()]),
            // Rutas navegables reales detectadas en disco (carpetas con index.php),
            // para que Módulos/Submódulos/Secciones elijan una ruta que sí existe.
            'routes'                 => $this->scanRoutes()
        ];
    }

    // Empresa del super-admin en sesión (fallback a la empresa base mientras no haya login).
    private function companyId() {
        return (int) ($_SESSION['company_id'] ?? 1);
    }

    // Escanea inventory/ (hasta 2 niveles) y devuelve las rutas navegables: las carpetas
    // que tienen index.php y, dentro de cada una, los archivos .php sueltos (ej.
    // operacion/almacen/salidas.php). Formato {id: ruta, valor: etiqueta}.
    private function scanRoutes() {
        // El controlador vive en inventory/tenant/ctrl/ -> la raíz del módulo es ../../
        $base = realpath(__DIR__ . '/../../');
        if ($base === false) return [];

        $skip   = ['conf', 'src', 'uploads', 'vendor', 'node_modules', '.git'];
        $routes = [];

        $top = @scandir($base);
        if ($top === false) return [];

        foreach ($top as $dir) {
            if ($dir === '.' || $dir === '..' || in_array($dir, $skip, true)) continue;
            $path = $base . DIRECTORY_SEPARATOR . $dir;
            if (!is_dir($path)) continue;

            // Nivel 1: carpeta con index.php + sus archivos .php directos.
            if (is_file($path . DIRECTORY_SEPARATOR . 'index.php')) {
                $routes[] = ['id' => $dir, 'valor' => $dir];
                $this->collectPhpFiles($path, $dir, $routes);
            }

            // Nivel 2: subcarpetas con index.php (ej. operacion/almacen, admin/usuarios).
            $sub = @scandir($path);
            if ($sub === false) continue;
            foreach ($sub as $child) {
                if ($child === '.' || $child === '..') continue;
                $childPath = $path . DIRECTORY_SEPARATOR . $child;
                if (is_dir($childPath) && is_file($childPath . DIRECTORY_SEPARATOR . 'index.php')) {
                    $route = $dir . '/' . $child;
                    $routes[] = ['id' => $route, 'valor' => $route];
                    // Archivos .php directos de la subcarpeta (ej. operacion/almacen/salidas.php).
                    $this->collectPhpFiles($childPath, $route, $routes);
                }
            }
        }

        // Orden alfabético por ruta para una lista predecible.
        usort($routes, function ($a, $b) { return strcmp($a['id'], $b['id']); });
        return $routes;
    }

    // Agrega a $routes los archivos .php que viven directamente en $dirPath (sin entrar a
    // subcarpetas), omitiendo index.php porque la carpeta ya lo representa como ruta.
    private function collectPhpFiles($dirPath, $prefix, &$routes) {
        $files = @scandir($dirPath);
        if ($files === false) return;
        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || $file === 'index.php') continue;
            if (strtolower(substr($file, -4)) !== '.php') continue;
            if (!is_file($dirPath . DIRECTORY_SEPARATOR . $file)) continue;
            $route = $prefix . '/' . $file;
            $routes[] = ['id' => $route, 'valor' => $route];
        }
    }

    /* ===== Empresas (companies) ===== */

    function lsCompanies() {
        $status = $this->companyStatusIn($_POST['status'] ?? 'active');
        $ls = $this->qCompanies([$status]);

        $row = [];
        foreach ($ls as $c) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'companies.editCompany(' . $c['id'] . ')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm bg-slate-100 hover:bg-slate-200 text-slate-600',
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

    /* ===== Planes (plans) ===== */

    function lsPlans() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qPlans([$active]);

        $row = [];
        foreach ($ls as $p) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'plans.editPlan(' . $p['id'] . ')'
            ];
            if ($p['is_active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'plans.togglePlan(' . $p['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
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
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'subscriptions.editSubscription(' . $s['id'] . ')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm bg-slate-100 hover:bg-slate-200 text-slate-600',
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
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'payments.editPayment(' . $p['id'] . ')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm bg-slate-100 hover:bg-slate-200 text-slate-600',
                'html'    => '<i class="icon-cog"></i>',
                'onclick' => "payments.changeStatus(" . $p['id'] . ", '" . $p['status'] . "')"
            ];
            if (!empty($p['invoice_url'])) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-secondary',
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
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'coupons.editCoupon(' . $c['id'] . ')'
            ];
            if ($c['is_active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'coupons.toggleCoupon(' . $c['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
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

    /* ===== Módulos (modules) ===== */

    function lsModules() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qModules([$active]);

        $row = [];
        foreach ($ls as $m) {
            $row[] = [
                'id'      => $m['id'],
                'Nombre'  => htmlspecialchars($m['name'] ?? ''),
                'Código'  => $m['code'] ?: '-',
                'Ruta'    => $m['route'] ?: '-',
                'Orden'   => $m['orden'] ?? 0,
                'Estado'  => renderActive($m['is_active']),
                'a'       => $this->toggleActions('modules', 'editModule', 'toggleModule', $m['id'], $m['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getModule() {
        $data = $this->qModule([(int) $_POST['id']]);
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Módulo no encontrado', 'data' => $data];
    }

    function addModule() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del módulo es obligatorio'];

        $ok = $this->qInsertModule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Módulo creado correctamente' : 'No se pudo crear el módulo'];
    }

    function editModule() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del módulo es obligatorio'];
        if (!$this->qModule([$id])) return ['status' => 404, 'message' => 'Módulo no encontrado'];

        $ok = $this->qUpdateModule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Módulo actualizado correctamente' : 'No se pudo actualizar el módulo'];
    }

    function toggleModule() {
        $id = (int) $_POST['id'];
        if (!$this->qModule([$id])) return ['status' => 404, 'message' => 'Módulo no encontrado'];
        $ok = $this->qSetModuleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Módulo activado' : 'Módulo desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Submódulos (submodules) ===== */

    function lsSubmodules() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qSubmodules([$active]);

        $row = [];
        foreach ($ls as $sm) {
            $row[] = [
                'id'      => $sm['id'],
                'Nombre'  => htmlspecialchars($sm['name'] ?? ''),
                'Módulo'  => $sm['module_name'] ? htmlspecialchars($sm['module_name']) : '<span class="italic text-gray-400">Sin módulo</span>',
                'Código'  => $sm['code'] ?: '-',
                'Ruta'    => $sm['route'] ?: '-',
                'Orden'   => $sm['orden'] ?? 0,
                'Estado'  => renderActive($sm['is_active']),
                'a'       => $this->toggleActions('submodules', 'editSubmodule', 'toggleSubmodule', $sm['id'], $sm['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getSubmodule() {
        $data = $this->qSubmodule([(int) $_POST['id']]);
        if ($data && $data['module_id'] !== null) $data['module_id'] = (string) $data['module_id'];
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Submódulo no encontrado', 'data' => $data];
    }

    function addSubmodule() {
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del submódulo es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];

        $ok = $this->qInsertSubmodule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Submódulo creado correctamente' : 'No se pudo crear el submódulo'];
    }

    function editSubmodule() {
        $id       = (int) $_POST['id'];
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del submódulo es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];

        $ok = $this->qUpdateSubmodule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Submódulo actualizado correctamente' : 'No se pudo actualizar el submódulo'];
    }

    function toggleSubmodule() {
        $id = (int) $_POST['id'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];
        $ok = $this->qSetSubmoduleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Submódulo activado' : 'Submódulo desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Secciones (sections) ===== */

    function lsSections() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qSections([$active]);

        $row = [];
        foreach ($ls as $s) {
            $row[] = [
                'id'         => $s['id'],
                'Nombre'     => htmlspecialchars($s['name'] ?? ''),
                'Módulo'     => $s['module_name'] ? htmlspecialchars($s['module_name']) : '-',
                'Submódulo'  => $s['submodule_name'] ? htmlspecialchars($s['submodule_name']) : '-',
                'Ruta'       => $s['route'] ?: '-',
                'Orden'      => $s['orden'] ?? 0,
                'Estado'     => renderActive($s['is_active']),
                'a'          => $this->toggleActions('sections', 'editSection', 'toggleSection', $s['id'], $s['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getSection() {
        $data = $this->qSection([(int) $_POST['id']]);
        if ($data) {
            $data['module_id']    = $data['module_id'] !== null ? (string) $data['module_id'] : '';
            $data['submodule_id'] = $data['submodule_id'] !== null ? (string) $data['submodule_id'] : '';
        }
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Sección no encontrada', 'data' => $data];
    }

    function addSection() {
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];

        $ok = $this->qInsertSection([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $this->selectOrNull($_POST['submodule_id'] ?? '')
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección creada correctamente' : 'No se pudo crear la sección'];
    }

    function editSection() {
        $id       = (int) $_POST['id'];
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];
        if (!$this->qSection([$id])) return ['status' => 404, 'message' => 'Sección no encontrada'];

        $ok = $this->qUpdateSection([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $this->selectOrNull($_POST['submodule_id'] ?? ''),
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección actualizada correctamente' : 'No se pudo actualizar la sección'];
    }

    function toggleSection() {
        $id = (int) $_POST['id'];
        if (!$this->qSection([$id])) return ['status' => 404, 'message' => 'Sección no encontrada'];
        $ok = $this->qSetSectionActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Sección activada' : 'Sección desactivada') : 'No se pudo actualizar el estado'];
    }

    /* ===== Tipos de permiso (type_permissions) ===== */

    function lsTypePermissions() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qTypePermissions([$active]);

        $row = [];
        foreach ($ls as $t) {
            $row[] = [
                'id'     => $t['id'],
                'Nombre' => htmlspecialchars($t['name'] ?? ''),
                'Estado' => renderActive($t['is_active']),
                'a'      => $this->toggleActions('typePermissions', 'editTypePermission', 'toggleTypePermission', $t['id'], $t['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getTypePermission() {
        $data = $this->qTypePermission([(int) $_POST['id']]);
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Tipo de permiso no encontrado', 'data' => $data];
    }

    function addTypePermission() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre es obligatorio'];
        $ok = $this->qInsertTypePermission([$name]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tipo de permiso creado' : 'No se pudo crear el tipo de permiso'];
    }

    function editTypePermission() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre es obligatorio'];
        if (!$this->qTypePermission([$id])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];
        $ok = $this->qUpdateTypePermission([$name, $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tipo de permiso actualizado' : 'No se pudo actualizar'];
    }

    function toggleTypePermission() {
        $id = (int) $_POST['id'];
        if (!$this->qTypePermission([$id])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];
        $ok = $this->qSetTypePermissionActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Activado' : 'Desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Roles (roles) ===== */

    function lsRoles() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qRoles([$active]);

        $row = [];
        foreach ($ls as $r) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'roles.editRole(' . $r['id'] . ')'
            ];
            // Los roles del sistema no se desactivan.
            if ((int) $r['is_system'] !== 1) {
                if ($r['is_active'] == 1) {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'roles.toggleRole(' . $r['id'] . ', 0)'
                    ];
                } else {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-outline-success',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'roles.toggleRole(' . $r['id'] . ', 1)'
                    ];
                }
            }

            $system = (int) $r['is_system'] === 1
                ? '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-sky-50 text-sky-700 ">Sistema</span>'
                : '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-600 ">Personalizado</span>';

            $row[] = [
                'id'     => $r['id'],
                'Código' => $r['code'] ?: '-',
                'Rol'    => htmlspecialchars($r['name'] ?? ''),
                'Tipo'   => $system,
                'Estado' => renderActive($r['is_active']),
                'a'      => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getRole() {
        $data = $this->qRole([(int) $_POST['id']]);
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Rol no encontrado', 'data' => $data];
    }

    function addRole() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        $ok = $this->qInsertRole([
            trim($_POST['code'] ?? '') ?: null,
            $name
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Rol creado correctamente' : 'No se pudo crear el rol'];
    }

    function editRole() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        if (!$this->qRole([$id])) return ['status' => 404, 'message' => 'Rol no encontrado'];
        $ok = $this->qUpdateRole([
            trim($_POST['code'] ?? '') ?: null,
            $name,
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Rol actualizado correctamente' : 'No se pudo actualizar el rol'];
    }

    function toggleRole() {
        $id   = (int) $_POST['id'];
        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ((int) $role['is_system'] === 1) {
            return ['status' => 400, 'message' => 'Los roles del sistema no se pueden desactivar'];
        }
        $ok = $this->qSetRoleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Rol activado' : 'Rol desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Permisos (permissions) ===== */

    function lsPermissions() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qPermissions([$active]);

        $row = [];
        foreach ($ls as $p) {
            $a = [];
            if ($p['is_active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'permissions.togglePermission(' . $p['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'permissions.togglePermission(' . $p['id'] . ', 1)'
                ];
            }

            $row[] = [
                'id'      => $p['id'],
                'Rol'     => $p['role_name'] ? htmlspecialchars($p['role_name']) : '—',
                'Sección' => $p['section_name'] ? htmlspecialchars($p['section_name']) : '—',
                'Tipo'    => $p['type_name'] ? htmlspecialchars($p['type_name']) : '—',
                'Estado'  => renderActive($p['is_active']),
                'a'       => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function addPermission() {
        $roleId = (int) ($_POST['role_id'] ?? 0);
        $secId  = (int) ($_POST['section_id'] ?? 0);
        $typeId = (int) ($_POST['type_permission_id'] ?? 0);

        if ($roleId <= 0 || $secId <= 0 || $typeId <= 0) {
            return ['status' => 400, 'message' => 'Rol, sección y tipo de permiso son obligatorios'];
        }
        if ($this->qPermissionExists([$roleId, $secId, $typeId])) {
            return ['status' => 409, 'message' => 'Ese permiso ya existe para el rol seleccionado'];
        }

        $ok = $this->qInsertPermission([$roleId, $secId, $typeId]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Permiso asignado correctamente' : 'No se pudo asignar el permiso'];
    }

    function togglePermission() {
        $id = (int) $_POST['id'];
        if (!$this->qPermission([$id])) return ['status' => 404, 'message' => 'Permiso no encontrado'];
        $ok = $this->qSetPermissionActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Permiso activado' : 'Permiso desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Matriz de acceso por rol (rol x seccion, modelo Acceso/No acceso) ===== */

    function accessMatrix() {
        $roleId = (int) ($_POST['role_id'] ?? 0);
        $role = $this->qRole([$roleId]);
        if (!$role) {
            return ['status' => 404, 'message' => 'Rol no encontrado'];
        }
        $typeId = $this->qAccessTypeId();
        if ($typeId <= 0) {
            return ['status' => 400, 'message' => 'No hay un tipo de permiso "Acceso" configurado'];
        }

        $isSuperAdmin = ($role['code'] === 'superadmin');
        $rows = $this->qAccessMatrix([$roleId, $typeId]);
        foreach ($rows as &$r) {
            $r['section_id']   = (int) $r['section_id'];
            $r['module_id']    = $r['module_id'] !== null ? (int) $r['module_id'] : 0;
            $r['submodule_id'] = $r['submodule_id'] !== null ? (int) $r['submodule_id'] : 0;
            $r['has_access']   = $isSuperAdmin ? true : ((int) $r['has_access'] === 1);
        }
        return [
            'status'    => 200,
            'role_id'   => $roleId,
            'is_system' => (int) ($role['is_system'] ?? 0),
            'sections'  => $rows
        ];
    }

    function accessRoles() {
        $typeId = $this->qAccessTypeId();
        if ($typeId <= 0) {
            return ['status' => 400, 'message' => 'No hay un tipo de permiso "Acceso" configurado'];
        }
        $ls = $this->qRolesWithAccessCount([$typeId]);
        $totalSections = 0;
        foreach ($ls as $r) {
            $totalSections = max($totalSections, (int) $r['total_sections']);
        }
        foreach ($ls as &$r) {
            $r['id']             = (int) $r['id'];
            $r['is_system']      = (int) $r['is_system'];
            $r['total_sections'] = (int) $r['total_sections'];
            $r['granted']        = ($r['code'] === 'superadmin') ? $totalSections : (int) $r['granted'];
        }
        return ['status' => 200, 'roles' => $ls];
    }

    function sectionPermissionTypes() {
        $roleId    = (int) $_POST['role_id'];
        $sectionId = (int) $_POST['section_id'];

        $role = $this->qRole([$roleId]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        $section = $this->qSection([$sectionId]);
        if (!$section) return ['status' => 404, 'message' => 'Sección no encontrada'];

        $isSuperAdmin = ($role['code'] === 'superadmin');
        $types = $this->qSectionPermissionTypes([$roleId, $sectionId]);

        foreach ($types as &$t) {
            $t['id']      = (int) $t['id'];
            $t['granted'] = $isSuperAdmin ? true : ((int) $t['granted'] === 1);
        }

        return ['status' => 200, 'types' => $types];
    }

    function savePermissions() {
        $roleId  = (int) $_POST['role_id'];
        $rawJson = $_POST['changes'];

        $role = $this->qRole([$roleId]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ((int) $role['is_system'] === 1) {
            return ['status' => 400, 'message' => 'Los roles del sistema no se editan'];
        }

        $changes = json_decode($rawJson, true);
        if (!is_array($changes)) {
            return ['status' => 400, 'message' => 'Payload de cambios inválido'];
        }

        $accessChanges = isset($changes['access']) && is_array($changes['access']) ? $changes['access'] : [];
        $typeChanges   = isset($changes['types'])  && is_array($changes['types'])  ? $changes['types']  : [];

        $typeId = $this->qAccessTypeId();
        if ($typeId <= 0 && count($accessChanges) > 0) {
            return ['status' => 400, 'message' => 'No hay un tipo de permiso "Acceso" configurado'];
        }

        return $this->transaction(function () use ($roleId, $typeId, $accessChanges, $typeChanges) {
            foreach ($accessChanges as $c) {
                $secId = (int) $c['section_id'];
                $grant = (int) $c['grant'] === 1;
                $existing = $this->qFindPermission([$roleId, $secId, $typeId]);
                if ($existing) {
                    $this->qSetPermissionActive([$grant ? 1 : 0, (int) $existing['id']]);
                } elseif ($grant) {
                    $this->qInsertPermission([$roleId, $secId, $typeId]);
                }
            }

            foreach ($typeChanges as $c) {
                $secId  = (int) $c['section_id'];
                $tId    = (int) $c['type_id'];
                $grant  = (int) $c['grant'] === 1;
                $existing = $this->qFindPermission([$roleId, $secId, $tId]);
                if ($existing) {
                    $this->qSetPermissionActive([$grant ? 1 : 0, (int) $existing['id']]);
                } elseif ($grant) {
                    $this->qInsertPermission([$roleId, $secId, $tId]);
                }
            }

            return ['status' => 200, 'message' => 'Permisos guardados'];
        });
    }

    // Concede o retira el acceso de un rol a TODAS las secciones, o a las de un módulo.
    // Espejo en bloque de toggleAccess: reutiliza el modelo binario "Acceso".
    function bulkAccess() {
        $roleId   = (int) ($_POST['role_id'] ?? 0);
        $grant    = (int) ($_POST['grant'] ?? 0) === 1;
        $moduleId = (int) ($_POST['module_id'] ?? 0); // 0 = todas las secciones

        $role = $this->qRole([$roleId]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ((int) $role['is_system'] === 1) {
            return ['status' => 400, 'message' => 'El acceso de los roles del sistema no se edita'];
        }

        $typeId = $this->qAccessTypeId();
        if ($typeId <= 0) return ['status' => 400, 'message' => 'No hay un tipo de permiso "Acceso" configurado'];

        $sections = $moduleId > 0
            ? $this->qSectionIdsByModule([$moduleId])
            : $this->qAllSectionIds();

        foreach ($sections as $s) {
            $secId    = (int) $s['id'];
            $existing = $this->qFindPermission([$roleId, $secId, $typeId]);
            if ($existing) {
                $this->qSetPermissionActive([$grant ? 1 : 0, (int) $existing['id']]);
            } elseif ($grant) {
                $this->qInsertPermission([$roleId, $secId, $typeId]);
            }
        }

        return [
            'status'  => 200,
            'message' => $grant ? 'Accesos habilitados' : 'Accesos deshabilitados'
        ];
    }

    // Activa o desactiva el acceso de un rol a UNA sección (insert o reactivación).
    function toggleAccess() {
        $roleId = (int) ($_POST['role_id'] ?? 0);
        $secId  = (int) ($_POST['section_id'] ?? 0);
        $grant  = (int) ($_POST['grant'] ?? 0) === 1;

        if (!$this->qRole([$roleId]))    return ['status' => 404, 'message' => 'Rol no encontrado'];
        if (!$this->qSection([$secId]))  return ['status' => 404, 'message' => 'Sección no encontrada'];

        $role = $this->qRole([$roleId]);
        if ((int) $role['is_system'] === 1) {
            return ['status' => 400, 'message' => 'El acceso de los roles del sistema no se edita'];
        }

        $typeId = $this->qAccessTypeId();
        if ($typeId <= 0) return ['status' => 400, 'message' => 'No hay un tipo de permiso "Acceso" configurado'];

        $existing = $this->qFindPermission([$roleId, $secId, $typeId]);
        if ($existing) {
            $ok = $this->qSetPermissionActive([$grant ? 1 : 0, (int) $existing['id']]);
        } elseif ($grant) {
            $ok = $this->qInsertPermission([$roleId, $secId, $typeId]);
        } else {
            $ok = true; // No existe y se pide quitar: nada que hacer.
        }

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($grant ? 'Acceso concedido' : 'Acceso retirado') : 'No se pudo actualizar el acceso'
        ];
    }

    /* ===== Usuarios y asignación de rol por sucursal (users_braches) ===== */

    function lsUsers() {
        $ls = $this->qUsersWithRole([$this->companyId()]);

        $row = [];
        foreach ($ls as $u) {
            $fullName = trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            $hasAssignment = !empty($u['assignment_id']);

            $a = [];
            if ($hasAssignment) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => "users.editAssignment({$u['assignment_id']}, " . (int) $u['role_id'] . ")"
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => "users.removeAssignment({$u['assignment_id']})"
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-success',
                    'html'    => '<i class="icon-plus"></i> Asignar',
                    'onclick' => "users.assign({$u['id']})"
                ];
            }

            $row[] = [
                'id'        => $u['id'],
                'Usuario'   => htmlspecialchars($fullName ?: '—'),
                'Correo'    => htmlspecialchars($u['email'] ?? '—'),
                'Sucursal'  => $u['branch_name'] ? htmlspecialchars($u['branch_name']) : '<span class="italic text-gray-400">Sin sucursal</span>',
                'Rol'       => $u['role_name']
                    ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#0b3a5c] text-[#5bb3f0]">' . htmlspecialchars($u['role_name']) . '</span>'
                    : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#5c4813] text-[#f5c451]">Sin rol</span>',
                'a'         => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    // Crea una asignación usuario+sucursal+rol (un usuario puede tener una por sucursal).
    function assignUserRole() {
        $userId   = (int) ($_POST['user_id'] ?? 0);
        $branchId = (int) ($_POST['branch_id'] ?? 0);
        $roleId   = (int) ($_POST['role_id'] ?? 0);

        if ($userId <= 0 || $branchId <= 0 || $roleId <= 0) {
            return ['status' => 400, 'message' => 'Usuario, sucursal y rol son obligatorios'];
        }
        if (!$this->qUserExistsInCompany([$userId, $this->companyId()])) {
            return ['status' => 400, 'message' => 'El usuario no pertenece a tu empresa'];
        }
        if (!$this->qRole([$roleId])) {
            return ['status' => 400, 'message' => 'El rol seleccionado no es válido'];
        }

        // Si ya existe la fila usuario+sucursal, se actualiza el rol en vez de duplicar.
        $existing = $this->qUserBranchAssignment([$userId, $branchId]);
        if ($existing) {
            $ok = $this->qSetUserBranchRole([$roleId, (int) $existing['id']]);
        } else {
            $ok = $this->qInsertUserBranchRole([$userId, $branchId, $roleId]);
        }

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Rol asignado correctamente' : 'No se pudo asignar el rol'
        ];
    }

    // Cambia solo el rol de una asignación existente.
    function updateUserRole() {
        $assignmentId = (int) ($_POST['assignment_id'] ?? 0);
        $roleId       = (int) ($_POST['role_id'] ?? 0);

        if ($assignmentId <= 0 || $roleId <= 0) {
            return ['status' => 400, 'message' => 'Asignación y rol son obligatorios'];
        }
        if (!$this->qRole([$roleId])) {
            return ['status' => 400, 'message' => 'El rol seleccionado no es válido'];
        }
        $ok = $this->qSetUserBranchRole([$roleId, $assignmentId]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Rol actualizado correctamente' : 'No se pudo actualizar el rol'];
    }

    function removeUserRole() {
        $assignmentId = (int) ($_POST['assignment_id'] ?? 0);
        if ($assignmentId <= 0) return ['status' => 400, 'message' => 'Asignación no válida'];
        $ok = $this->qDeleteUserBranchRole([$assignmentId]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Asignación eliminada' : 'No se pudo eliminar la asignación'];
    }

    /* ===== Helpers internos ===== */

    // Acciones estándar editar + activar/desactivar para entidades del catálogo.
    private function toggleActions($jsObj, $editFn, $toggleFn, $id, $isActive) {
        $a = [];
        $a[] = [
            'class'   => 'btn btn-sm btn-primary me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "{$jsObj}.{$editFn}({$id})"
        ];
        if ((int) $isActive === 1) {
            $a[] = [
                'class'   => 'btn btn-sm btn-danger',
                'html'    => '<i class="icon-toggle-on"></i>',
                'onclick' => "{$jsObj}.{$toggleFn}({$id}, 0)"
            ];
        } else {
            $a[] = [
                'class'   => 'btn btn-sm btn-outline-success',
                'html'    => '<i class="icon-toggle-off"></i>',
                'onclick' => "{$jsObj}.{$toggleFn}({$id}, 1)"
            ];
        }
        return $a;
    }

    private function paymentStatusIn($v) {
        return in_array($v, $this->paymentStatuses, true) ? $v : 'paid';
    }

    private function companyStatusIn($v) {
        return in_array($v, $this->companyStatuses, true) ? $v : 'active';
    }

    private function subStatusIn($v) {
        return in_array($v, $this->subStatuses, true) ? $v : 'active';
    }

    private function intOrNull($v) {
        $v = trim((string) $v);
        return $v === '' ? null : (int) $v;
    }

    // Para selects OPCIONALES con placeholder "-- Selecciona --" (value="0"):
    // tanto '' como '0' significan "sin valor" -> NULL (no rompe la FK).
    private function selectOrNull($v) {
        $v = trim((string) $v);
        return ($v === '' || $v === '0') ? null : (int) $v;
    }

    private function dateOrNull($v) {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
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
        case 'suspendend':
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

function renderAvatar($name) {
    $name = trim((string) $name);
    if ($name === '') {
        $initials = '?';
    } else {
        $parts = preg_split('/\s+/', $name);
        $initials = mb_strtoupper(mb_substr($parts[0], 0, 1));
        if (count($parts) > 1) {
            $initials .= mb_strtoupper(mb_substr($parts[count($parts) - 1], 0, 1));
        } elseif (mb_strlen($parts[0]) > 1) {
            $initials .= mb_strtoupper(mb_substr($parts[0], 1, 1));
        }
    }
    $safeName = htmlspecialchars($name);
    $safeInitials = htmlspecialchars($initials);
    return '<div class="flex items-center gap-2">'
        . '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 text-xs font-semibold shrink-0">' . $safeInitials . '</span>'
        . '<span>' . $safeName . '</span>'
        . '</div>';
}

function renderDiscount($type, $value) {
    $value = (float) $value;
    if ($type === 'percent') {
        return rtrim(rtrim(number_format($value, 2), '0'), '.') . '%';
    }
    return '$' . number_format($value, 2);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
