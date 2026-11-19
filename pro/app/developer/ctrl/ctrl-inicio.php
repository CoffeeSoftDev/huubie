<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-inicio.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';

/*  DEVELOPER › ACCESOS › INICIO: las tarjetas que un dueño puede poner en su
    inicio, por modulo.

    Cada tarjeta (home_widgets) es de un modulo o General (module_id NULL) y
    usa una FUNCION de HomeLayout::FUNCTIONS, que es la que le da datos y la
    que dice como se pinta. Aqui se dan de alta, se editan, se apagan y se
    borran, y se arma el inicio de fabrica: que tarjetas trae un dueño que no
    lo ha personalizado, en que zona y en que orden.

    Apagar una tarjeta la saca del catalogo y de todos los inicios, pero los
    acomodos se conservan: al prenderla vuelve a donde estaba. Borrar solo se
    puede apagada, y se lleva esos acomodos.

    Va con los mismos permisos que la pagina Accesos. */
class ctrl extends mdl {

    const ZONE_NAMES = ['top' => 'Arriba', 'main' => 'Columna principal', 'side' => 'Columna lateral'];

    /*  Todo lo de la pestaña en una sola respuesta: los modulos con cuantas
        empresas los tienen, el catalogo completo con su uso, las funciones que
        se pueden usar y los totales. */
    function lsHomeWidgets() {
        if (!$this->qHomeReady()) {
            return ['status' => 503, 'ready' => 0, 'message' => 'Falta correr la migración 2026-11-19_inicio-personalizable.sql.'];
        }

        $modules = [];
        foreach ($this->qHomeModules() as $m) {
            $modules[] = [
                'id'          => (int) $m['id'],
                'name'        => (string) $m['name'],
                'code'        => (string) $m['code'],
                'icon'        => $m['icon'] ?: 'layout-grid',
                'description' => (string) $m['description'],
                'active'      => (int) $m['is_active'],
                'companies'   => (int) $m['companies'],
            ];
        }

        $byCode = array_column($modules, 'name', 'code');

        $functions = [];
        foreach (HomeLayout::FUNCTIONS as $fn => $f) {
            $functions[] = [
                'id'          => $fn,
                'name'        => $f['name'],
                'module'      => $f['module'],
                'module_name' => $f['module'] === null ? 'General' : ($byCode[$f['module']] ?? $f['module']),
                'zones'       => HomeLayout::zonesOf($f['zones']),
            ];
        }

        $widgets = [];
        foreach ($this->qHomeWidgets() as $w) $widgets[] = $this->widgetRow($w);

        return [
            'status'    => 200,
            'ready'     => 1,
            'modules'   => $modules,
            'widgets'   => $widgets,
            'functions' => $functions,
            'zones'     => self::ZONE_NAMES,
            'companies' => $this->qActiveCompanies(),
            'custom'    => $this->qCustomHomes(),
        ];
    }

    function getHomeWidget() {
        $w = $this->qHomeWidget([(int) ($_POST['id'] ?? 0)]);
        if (!$w) return ['status' => 404, 'message' => 'Tarjeta no encontrada'];

        $row = $this->widgetRow($w);

        // Lo que llena el formulario (autofill): mismos ids que sus campos.
        $row['module_id']   = $w['module_id'] === null ? 'general' : (string) (int) $w['module_id'];
        $row['description'] = (string) $w['description'];
        $row['is_default']  = (int) $w['is_default'] === 1 ? 'yes' : 'no';

        return ['status' => 200, 'data' => $row];
    }

    function addHomeWidget() {
        $in = $this->posted(null);
        if (isset($in['error'])) return ['status' => 400, 'message' => $in['error']];

        $ok = $this->qInsertHomeWidget([
            $in['code'], $in['name'], $in['description'], $in['icon'], $in['module_id'], $in['fn'],
            $in['zone'], implode(',', $in['zones']), $in['route'], $this->qNextHomeOrder(), $in['default'],
        ]) === true;

        return $ok
             ? ['status' => 200, 'message' => 'Tarjeta creada. Ya la pueden poner en su inicio las empresas que tienen su módulo.']
             : ['status' => 500, 'message' => 'No se pudo crear la tarjeta'];
    }

    // El code no cambia: es como la conocen los borradores de Configuración › Mi inicio.
    function editHomeWidget() {
        $id  = (int) ($_POST['id'] ?? 0);
        $old = $this->qHomeWidget([$id]);
        if (!$old) return ['status' => 404, 'message' => 'Tarjeta no encontrada'];

        $in = $this->posted($old);
        if (isset($in['error'])) return ['status' => 400, 'message' => $in['error']];

        $ok = $this->qUpdateHomeWidget([
            $in['name'], $in['description'], $in['icon'], $in['module_id'], $in['fn'],
            $in['zone'], implode(',', $in['zones']), $in['route'], $in['default'], $id,
        ]) === true;

        return $ok
             ? ['status' => 200, 'message' => 'Tarjeta actualizada']
             : ['status' => 500, 'message' => 'No se pudo actualizar la tarjeta'];
    }

    function toggleHomeWidget() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        if (!$this->qHomeWidget([$id])) return ['status' => 404, 'message' => 'Tarjeta no encontrada'];

        $ok = $this->qSetHomeWidgetActive([$active, $id]) === true;

        return [
            'status'  => $ok ? 200 : 500,
            'message' => !$ok ? 'No se pudo actualizar el estado'
                       : ($active ? 'Tarjeta encendida: vuelve a los inicios donde estaba' : 'Tarjeta apagada: sale del catálogo y de todos los inicios'),
        ];
    }

    // Solo apagada, como las secciones: asi nadie la pierde sin haberla visto desaparecer antes.
    function deleteHomeWidget() {
        $id = (int) ($_POST['id'] ?? 0);
        $w  = $this->qHomeWidget([$id]);

        if (!$w) return ['status' => 404, 'message' => 'Tarjeta no encontrada'];
        if ((int) $w['is_active'] === 1) return ['status' => 400, 'message' => 'Apágala primero: solo se elimina una tarjeta apagada'];

        $ok = $this->qDeleteHomeWidget([$id]) === true;

        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tarjeta eliminada' : 'No se pudo eliminar la tarjeta'];
    }

    /*  EL INICIO DE FABRICA. `items` llega como JSON [{id, zone, default}] en el
        orden en que se ven: primero las de fabrica (Arriba, Principal,
        Lateral) y despues las que no salen de fabrica. El orden se reparte de
        10 en 10 en ese mismo orden; la zona de una que no sale de fabrica no
        cambia (es donde cae cuando el dueño la agrega). */
    function saveFactory() {
        $items = json_decode((string) ($_POST['items'] ?? ''), true);
        if (!is_array($items) || !$items) return ['status' => 400, 'message' => 'No llegó el acomodo'];

        $rows = [];
        foreach ($items as $item) {
            $w = $this->qHomeWidget([(int) ($item['id'] ?? 0)]);
            if (!$w) return ['status' => 404, 'message' => 'Una de las tarjetas ya no existe. Recarga la pestaña.'];

            $default = !empty($item['default']) ? 1 : 0;
            $zone    = $default ? (string) ($item['zone'] ?? '') : $w['zone'];

            if ($default && !in_array($zone, $this->allowedZones($w), true)) {
                return ['status' => 400, 'message' => '«' . $w['name'] . '» no puede ir en ' . (self::ZONE_NAMES[$zone] ?? 'esa zona') . '.'];
            }

            $rows[] = [$zone, $default, (int) $w['id']];
        }

        return $this->transaction(function () use ($rows) {
            $orden = 0;
            foreach ($rows as $r) $this->qSetHomeWidgetFactory([$r[0], $r[1], $orden += 10, $r[2]]);

            return ['status' => 200, 'message' => 'Inicio de fábrica actualizado'];
        });
    }

    // ============================================================ Comunes

    // Una fila del catalogo como la pinta la pestaña.
    private function widgetRow($w) {
        $fn = HomeLayout::FUNCTIONS[$w['fn']] ?? null;

        return [
            'id'        => (int) $w['id'],
            'code'      => (string) $w['code'],
            'name'      => (string) $w['name'],
            'text'      => (string) $w['description'],
            'icon'      => $w['icon'] ?: 'square',
            'module_id' => $w['module_id'] === null ? 0 : (int) $w['module_id'],
            'fn'        => (string) $w['fn'],
            // La funcion ya no existe en el codigo: la tarjeta no se le ofrece a nadie.
            'fn_ok'     => $fn ? 1 : 0,
            'zone'      => (string) $w['zone'],
            'zones'     => $this->allowedZones($w),
            'route'     => (string) $w['route'],
            'orden'     => (int) $w['orden'],
            'default'   => (int) $w['is_default'],
            'active'    => (int) $w['is_active'],
            'homes'     => (int) $w['homes'],
        ];
    }

    // Donde puede ir: lo que dice la tarjeta, sin salirse de donde se ve bien su funcion.
    private function allowedZones($w) {
        $fn    = HomeLayout::FUNCTIONS[$w['fn']] ?? null;
        $zones = HomeLayout::zonesOf($w['zones']);

        return $fn ? array_values(array_intersect($zones, HomeLayout::zonesOf($fn['zones']))) : $zones;
    }

    /*  Lo que llega del formulario, validado, o ['error' => por que no].
        $old: la tarjeta que se edita (su code no cambia), o null al crear. */
    private function posted($old) {
        $name  = $this->text('name', 80);
        $text  = $this->text('description', 255);
        $icon  = strtolower((string) $this->text('icon', 40));
        $fn    = (string) ($_POST['fn'] ?? '');
        $zone  = (string) ($_POST['zone'] ?? '');
        $zones = HomeLayout::zonesOf($_POST['zones'] ?? '');
        $route = (string) $this->text('route', 160);
        $mod   = (string) ($_POST['module_id'] ?? '');

        if ($name === null) return ['error' => 'Ponle nombre a la tarjeta'];

        $code = $old ? (string) $old['code'] : strtolower((string) $this->text('code', 60));
        if (!$old) {
            if (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $code)) return ['error' => 'El código va en minúsculas, números y guiones (se arma solo con el nombre)'];
            if ($this->qHomeWidgetCodeTaken([$code, 0]))         return ['error' => 'Ya hay una tarjeta con el código «' . $code . '». Cambia el nombre.'];
        }

        if (!isset(HomeLayout::FUNCTIONS[$fn])) return ['error' => 'Elige la función que le da sus datos'];

        $moduleId = null;
        if ($mod !== 'general') {
            $module = $this->qHomeModule([(int) $mod]);
            if (!$module) return ['error' => 'Elige su módulo, o General si es de todas las empresas'];
            $moduleId = (int) $module['id'];
        }

        $fits = HomeLayout::zonesOf(HomeLayout::FUNCTIONS[$fn]['zones']);
        if (!$zones) return ['error' => 'Marca al menos una zona donde puede ir'];

        $outside = array_diff($zones, $fits);
        if ($outside) {
            $names = array_map(function ($z) { return self::ZONE_NAMES[$z]; }, $outside);
            return ['error' => 'Esa función no se ve bien en ' . implode(' ni en ', $names) . '.'];
        }

        if (!in_array($zone, $zones, true)) return ['error' => 'Elige dónde cae al agregarla, entre las zonas que marcaste'];

        if ($icon !== '' && !preg_match('/^[a-z0-9-]+$/', $icon)) return ['error' => 'El ícono es el nombre de uno de Lucide (ej. trophy)'];

        // Relativa a pro/ y sin salir de ella: sin esquema, sin // al inicio y sin ..
        if ($route !== '' && (!preg_match('#^[A-Za-z0-9_\-./\#?=&]+$#', $route) || strpos($route, '..') !== false || $route[0] === '/')) {
            return ['error' => 'La ruta va relativa a pro/, por ejemplo app/order/pedidos.php'];
        }

        return [
            'code'        => $code,
            'name'        => $name,
            'description' => $text,
            'icon'        => $icon === '' ? null : $icon,
            'module_id'   => $moduleId,
            'fn'          => $fn,
            'zone'        => $zone,
            'zones'       => $zones,
            'route'       => $route === '' ? null : $route,
            'default'     => ($_POST['is_default'] ?? 'no') === 'yes' ? 1 : 0,
        ];
    }

    // Texto recortado al ancho de su columna; vacio -> null.
    private function text($key, $max) {
        $value = trim(preg_replace('/\s+/', ' ', (string) ($_POST[$key] ?? '')));
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}

Permission::dispatch(new ctrl(), 'accesos');
