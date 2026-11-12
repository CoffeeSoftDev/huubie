<?php
/*  PLANES PÚBLICOS: lo que cada página de precios pide para pintar sus planes
    (la landing de CoffeeSoft, las de Huubie). page es el código de su
    clasificación en Facturación › Clasificaciones ('coffeesoft').

    Sin sesión y de solo lectura: precios y módulos que ya se publican. Las
    landings viven en otros dominios, por eso cualquiera puede leerlo. */
header('Access-Control-Allow-Origin: *');
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-planes.php';

class ctrl extends mdl {
    const OPS = ['ls'];

    function ls() {
        $page = $this->getClassificationByCode([trim((string) $_POST['page'])]);
        if (!$page) {
            return ['status' => 404, 'message' => 'Página de precios no encontrada', 'modules' => [], 'plans' => []];
        }

        $modules = array_map(function ($m) {
            return [
                'id'    => (int) $m['id'],
                'name'  => $m['name'],
                'icon'  => $m['icon'] ?: 'layout-grid',
                'text'  => $m['description'] ?: '',
                'price' => $m['price'] !== null ? (float) $m['price'] : null
            ];
        }, $this->listModules());

        $sellable = array_column($modules, 'id');

        $plans = array_map(function ($p) use ($sellable) {
            return [
                'code'     => $p['code'] ?: 'plan-' . $p['id'],
                'name'     => $p['name'],
                'text'     => $p['description'] ?: '',
                // 'all' es un kit con todos los que se venden.
                'mode'     => $p['modules_mode'] === 'all' ? 'included' : $p['modules_mode'],
                'pick'     => $p['modules_pick'] !== null ? (int) $p['modules_pick'] : null,
                'modules'  => $p['modules_mode'] === 'all' ? $sellable : array_values(array_intersect($this->idList($p['module_ids']), $sellable)),
                'price'    => $p['price'] !== null ? (float) $p['price'] : null,
                'before'   => $p['price_before'] !== null ? (float) $p['price_before'] : null,
                'cycle'    => $p['billing_cycle'] ?: 'monthly',
                'currency' => $p['currency'] ?: 'MXN',
                'featured' => (int) $p['featured'] === 1,
                'features' => array_values(array_unique(array_merge($this->limits($p), $this->features($p['features']))))
            ];
        }, $this->listPlansByClassification([(int) $page['id']]));

        return [
            'status'  => 200,
            'page'    => ['name' => $page['name'], 'code' => $page['code']],
            'modules' => $modules,
            'plans'   => $plans
        ];
    }

    // Los topes del plan, como se leen en la tarjeta: "Hasta 2 usuarios", "1 sucursal".
    private function limits($p) {
        $users    = $p['max_users'];
        $branches = $p['max_branches'];

        $list   = [];
        $list[] = $users === null ? 'Usuarios ilimitados' : 'Hasta ' . (int) $users . ((int) $users === 1 ? ' usuario' : ' usuarios');
        $list[] = $branches === null ? 'Sucursales ilimitadas' : (int) $branches . ((int) $branches === 1 ? ' sucursal' : ' sucursales');
        if ((int) $p['trial_days'] > 0) $list[] = (int) $p['trial_days'] . ' días de prueba';

        return $list;
    }

    // plans.features es un JSON con la lista de lo que incluye.
    private function features($json) {
        $list = json_decode((string) $json, true);
        return is_array($list) ? array_values(array_filter($list, 'is_string')) : [];
    }

    // "2,4,3" (GROUP_CONCAT) -> [2, 4, 3]
    private function idList($csv) {
        return $csv ? array_map('intval', explode(',', $csv)) : [];
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
