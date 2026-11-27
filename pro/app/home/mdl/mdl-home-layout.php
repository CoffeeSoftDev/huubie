<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/security/_Plan.php';

/*  LAS TARJETAS DEL INICIO DEL DUEÑO: cuales hay, de que modulo es cada una y
    como acomodo las suyas cada dueño. Lo usan el inicio (ctrl-home, para
    pintarlas) y Configuración › Mi inicio (para elegirlas y acomodarlas), asi
    que lo que se elige y lo que se ve no pueden discrepar.

      home_widgets       el catalogo (migracion 2026-11-19_inicio-personalizable).
                         module_id NULL = General: la tiene toda empresa. Con
                         modulo, solo la empresa que lo contrato.
      user_home_widgets  el acomodo de cada dueño en cada empresa: que tarjetas,
                         en que zona y en que orden. Sin filas = el de fabrica.

    Las zonas son las del inicio de siempre:
      top   arriba, a todo lo ancho (las cifras del dia)
      main  la columna principal
      side  la columna lateral, angosta (en el telefono va debajo)

    Dos preguntas distintas sobre que tarjetas tiene una empresa (usable):
      $now = false  las de lo que CONTRATO, al corriente o no. Configuración
                    ofrece estas: el dueño acomoda su inicio aunque deba el pago.
      $now = true   las que puede VER hoy: las de modulos que le abren ahora
                    (Plan::allows). Con el pago vencido solo quedan las
                    generales, igual que hoy no le abren sus modulos. */
class HomeLayout extends CRUD {
    const ZONES = ['top', 'main', 'side'];

    // Cuantas tarjetas caben en un inicio, a lo mucho.
    const MAX = 24;

    /*  LAS FUNCIONES QUE LE DAN DATOS A UNA TARJETA (home_widgets.fn). Cada una
        es una funcion publica de HomeWidgets (app/home/ctrl/widgets-home.php)
        y se pinta en home.js (HOME_WIDGETS) por el mismo nombre. Solo estas se
        pueden poner en el catalogo: Developer › Accesos › Inicio las ofrece y
        HomeWidgets::run() no corre otra.

          name    que muestra, para quien arma el catalogo
          module  de donde lee sus datos (modules.code; null = de todos). Una
                  tarjeta con esta funcion en otro modulo puede salir vacia en
                  las empresas que no tienen este.
          zones   donde se ve bien: una tarjeta con esta funcion solo puede ir
                  en estas zonas (una tabla no cabe en la columna lateral).

        Una funcion nueva: su entrada aqui, su funcion en HomeWidgets y como se
        pinta en home.js. Despues, sus tarjetas se dan de alta desde Developer. */
    const FUNCTIONS = [
        'atencion'       => ['name' => 'Pendientes del día',                 'module' => null,             'zones' => 'top,main,side'],
        'suscripcion'    => ['name' => 'Plan, estado y próximo pago',        'module' => null,             'zones' => 'main,side'],
        'modulos'        => ['name' => 'Accesos a los módulos del plan',     'module' => null,             'zones' => 'top,main'],
        'actividad'      => ['name' => 'Bitácora de lo último que pasó',     'module' => null,             'zones' => 'top,main,side'],
        'ventasHoy'      => ['name' => 'Cifras de venta de hoy',             'module' => 'pedidos',        'zones' => 'top,main'],
        'ventasSucursal' => ['name' => 'Tabla de hoy por sucursal',          'module' => 'pedidos',        'zones' => 'top,main'],
        'ventasDias'     => ['name' => 'Gráfica de ventas de 14 días',       'module' => 'pedidos',        'zones' => 'top,main,side'],
        'topProductos'   => ['name' => 'Ranking de productos del mes',       'module' => 'pedidos',        'zones' => 'main,side'],
        'topClientes'    => ['name' => 'Ranking de clientes del mes',        'module' => 'pedidos',        'zones' => 'main,side'],
        'entregas'       => ['name' => 'Entregas de hoy a pasado mañana',    'module' => 'pedidos',        'zones' => 'top,main,side'],
        'cumpleanos'     => ['name' => 'Cumpleaños del mes',                 'module' => 'capital-humano', 'zones' => 'main,side'],
        'lealtadMes'     => ['name' => 'Resumen de lealtad del mes',         'module' => 'lealtad',        'zones' => 'main,side'],
    ];

    private $catalog = null;

    // Las tablas existen (la migracion ya corrio). Mientras no, no hay tarjetas.
    function ready() {
        $r = $this->_Read("SHOW TABLES LIKE 'home_widgets'");
        return is_array($r) && !empty($r);
    }

    /*  Todas las tarjetas activas, en el orden de fabrica. Una con modulo
        apagado (modules.is_active = 0) no se ofrece a nadie. */
    function catalog() {
        if ($this->catalog !== null) return $this->catalog;

        $rows = $this->_Read("
            SELECT
                w.id, w.code, w.name, w.description, w.icon, w.fn, w.zone, w.zones, w.route, w.is_default,
                m.id AS module_id, m.code AS module_code, m.name AS module_name, m.icon AS module_icon
            FROM home_widgets w
            LEFT JOIN modules m ON m.id = w.module_id
            WHERE w.is_active = 1
              AND (w.module_id IS NULL OR m.is_active = 1)
            ORDER BY w.orden IS NULL, w.orden, w.id
        ");

        $this->catalog = [];

        foreach (is_array($rows) ? $rows : [] as $r) {
            // Una tarjeta con una funcion que esta version no conoce no se ofrece.
            if (!isset(self::FUNCTIONS[$r['fn']])) continue;

            // Donde la deja estar el catalogo, sin salirse de donde se ve bien su funcion.
            $fits  = self::zonesOf(self::FUNCTIONS[$r['fn']]['zones']);
            $zones = array_values(array_intersect(self::zonesOf($r['zones']), $fits));
            if (!$zones) $zones = $fits;

            $zone = in_array($r['zone'], $zones, true) ? $r['zone'] : $zones[0];

            $this->catalog[$r['code']] = [
                'id'      => (int) $r['id'],
                'code'    => (string) $r['code'],
                'name'    => (string) $r['name'],
                'text'    => (string) $r['description'],
                'icon'    => $r['icon'] ?: 'square',
                'fn'      => (string) $r['fn'],
                'zone'    => $zone,
                'zones'   => $zones,
                'route'   => trim((string) $r['route']),
                'default' => (int) $r['is_default'] === 1,
                // null = General
                'module'  => $r['module_id'] === null ? null : [
                    'id'   => (int) $r['module_id'],
                    'code' => (string) $r['module_code'],
                    'name' => (string) $r['module_name'],
                    'icon' => $r['module_icon'] ?: 'layout-grid',
                ],
            ];
        }

        return $this->catalog;
    }

    // 'top,side' -> ['top', 'side']: solo zonas que existen, en su orden.
    static function zonesOf($csv) {
        return array_values(array_intersect(self::ZONES, array_map('trim', explode(',', (string) $csv))));
    }

    // Las tarjetas que tiene esta empresa, por code. $now: ver el comentario de arriba.
    function usable($now) {
        $contracted = [];
        foreach (Plan::modules() as $m) $contracted[(int) $m['id']] = true;

        $out = [];

        foreach ($this->catalog() as $code => $w) {
            if ($w['module'] !== null) {
                if (!isset($contracted[$w['module']['id']])) continue;
                if ($now && !Plan::allows($w['module']['id'], $w['module']['code'])) continue;
            }

            $out[$code] = $w;
        }

        return $out;
    }

    /*  El inicio de un dueño: [['code', 'zone'], ...] en orden (top, main y
        side, cada una con el suyo). custom = ya lo personalizo.

        De lo que guardo se queda solo lo que esta en $usable (si dejo de tener
        un modulo, sus tarjetas no salen; si lo vuelve a contratar, vuelven). Si
        de lo suyo no queda nada que enseñar, sale el de fabrica. */
    function forUser($userId, $companyId, array $usable) {
        $rows = $this->_Read("
            SELECT w.code, u.zone
            FROM user_home_widgets u
            INNER JOIN home_widgets w ON w.id = u.widget_id
            WHERE u.user_id = ? AND u.company_id = ?
            ORDER BY FIELD(u.zone, 'top', 'main', 'side'), u.orden, u.id
        ", [(int) $userId, (int) $companyId]);

        $rows  = is_array($rows) ? $rows : [];
        $items = [];

        foreach ($rows as $r) {
            $w = $usable[$r['code']] ?? null;
            if (!$w) continue;

            // Si el catalogo ya no la deja en esa zona, se va a la suya.
            $items[] = ['code' => $w['code'], 'zone' => in_array($r['zone'], $w['zones'], true) ? $r['zone'] : $w['zone']];
        }

        if (!$items) $items = $this->defaults($usable);

        return ['custom' => !empty($rows), 'items' => $this->sorted($items)];
    }

    // El de fabrica: las is_default, cada una en su zona, en el orden del catalogo.
    function defaults(array $usable) {
        $items = [];

        foreach ($usable as $w) {
            if ($w['default']) $items[] = ['code' => $w['code'], 'zone' => $w['zone']];
        }

        return $this->sorted($items);
    }

    // Por zona (top, main, side), respetando el orden que traian dentro de cada una.
    private function sorted(array $items) {
        $out = [];

        foreach (self::ZONES as $zone) {
            foreach ($items as $item) {
                if ($item['zone'] === $zone) $out[] = $item;
            }
        }

        return $out;
    }

    /*  Guarda el acomodo de un dueño. $items: [['code', 'zone'], ...] en el
        orden en que se ven. Devuelve null, o el porque no se acepto.

        Cada tarjeta tiene que ser de las que su empresa tiene ($usable) y estar
        en una zona que le toca; ninguna dos veces. Se guarda todo de nuevo:
        lo de modulos que ya no tiene se pierde aqui. */
    function save($userId, $companyId, array $items, array $usable) {
        $clean = [];
        $seen  = [];

        foreach ($items as $item) {
            $code = is_array($item) ? (string) ($item['code'] ?? '') : '';
            $zone = is_array($item) ? (string) ($item['zone'] ?? '') : '';
            $w    = $usable[$code] ?? null;

            if (!$w) return 'Una de las tarjetas no está disponible para tu empresa. Recarga la página e inténtalo de nuevo.';
            if (!in_array($zone, $w['zones'], true)) return '«' . $w['name'] . '» no cabe en esa parte de tu inicio.';
            if (isset($seen[$code])) continue;

            $seen[$code] = true;
            $clean[]     = ['id' => $w['id'], 'zone' => $zone];
        }

        if (!$clean)                  return 'Deja al menos una tarjeta en tu inicio.';
        if (count($clean) > self::MAX) return 'Tu inicio admite hasta ' . self::MAX . ' tarjetas.';

        $this->transaction(function () use ($userId, $companyId, $clean) {
            $this->_CUD("DELETE FROM user_home_widgets WHERE user_id = ? AND company_id = ?", [(int) $userId, (int) $companyId]);

            $orden = array_fill_keys(self::ZONES, 0);

            foreach ($clean as $c) {
                $this->_CUD("
                    INSERT INTO user_home_widgets (user_id, company_id, widget_id, zone, orden, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                ", [(int) $userId, (int) $companyId, $c['id'], $c['zone'], ++$orden[$c['zone']]]);
            }
        });

        return null;
    }

    // Vuelve al de fabrica: sin filas.
    function reset($userId, $companyId) {
        return $this->_CUD("DELETE FROM user_home_widgets WHERE user_id = ? AND company_id = ?", [(int) $userId, (int) $companyId]) === true;
    }
}
?>
