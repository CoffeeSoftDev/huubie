<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Arranque de la pagina: empresa y sucursal, contadores de las pestañas y filtro de estado.
class ctrl extends core {

    public function init() {
        $scope  = $this->scope();
        $filter = $this->statusFilter();
        $fail   = $this->needBranch();

        if ($fail) return array_merge($fail, ['scope' => $scope, 'counts' => [], 'statusFilter' => $filter]);

        $company = $scope['company_id'];
        $branch  = $scope['branch_id'];

        return [
            'status' => 200,
            'scope'  => $scope,
            'counts' => [
                'products'       => $this->qCountProducts($company, $branch, $this->mainBranchId()),
                'categories'     => $this->qCountCategories($branch),
                'subcategories'  => $this->qCountSubcategories($branch),
                'modifiers'      => $this->qCountModifierGroups($company),
                'bundles'        => $this->qCountBundles($company, $branch),
                'paymentMethods' => $this->qCountPaymentMethods($company),
                'discounts'      => $this->qCountDiscounts($company)
            ],
            'statusFilter' => $filter
        ];
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
