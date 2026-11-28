<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Categorías: cada categoria es de una sucursal.
    Ícono (28/11/2026): el que se ve en el POS (Ventas, captura de pedidos y la
    tienda en línea). Sin elegir (NULL), el POS lo adivina por el nombre con
    las mismas reglas de autoRules. */
class ctrl extends core {

    // Íconos para elegir, con su dibujo, y las reglas del automático (la vista previa del modal).
    public function formOptions() {
        $icons = [];

        foreach ($this->categoryIcons() as $name => $icon) {
            $icons[] = ['id' => $name, 'valor' => $icon[0], 'svg' => $this->iconSvg($name, 22)];
        }

        $rules = array_map(fn ($rule) => ['pattern' => $rule[0], 'icon' => $rule[1]], $this->autoRules());

        return ['status' => 200, 'icons' => $icons, 'autoRules' => $rules, 'autoDefault' => 'package'];
    }

    public function lsCategories() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $branch = $this->branchId();
        $row    = [];

        foreach ($this->qListCategories($branch, $this->activeFilter()) as $item) {
            $id   = (int) $item['id'];
            $subs = (int) $item['subcategories'];

            $row[] = [
                'id'            => $id,
                'Categoría'     => $this->categoryCell($item),
                'Descripción'   => $this->shortDescription($item['description']),
                // Sin subcategorías: la raya gris de las celdas vacías (como Descripción), no un 0.
                'Subcategorías' => $subs > 0 ? $subs : '<span class="cp-celda-sub">—</span>',
                'Productos'     => (int) $item['products'],
                'Estado'        => renderActive($item['active']),
                'a'             => $this->rowActions('categories', $id, $item['active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountCategories($branch)];
    }

    public function getCategory() {
        $data = $this->qGetCategory($this->postId(), $this->branchId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'La categoría no existe.');
    }

    public function addCategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $in = $this->categoryInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindCategoryByName($this->branchId(), $in['name']);
        if ($dup) return $this->duplicated($dup, 'una categoría con ese nombre');

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateCategory([
                'values' => ['name', 'description', 'icon', 'branch_id', 'active'],
                'data'   => [$in['name'], $in['description'], $in['icon'], $this->branchId(), 1]
            ]), 'addCategory');

            return $this->ok('Categoría creada.');
        }, 'No se pudo guardar la categoría.');
    }

    public function editCategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qGetCategory($id, $this->branchId())) return $this->fail(404, 'La categoría no existe.');

        $in = $this->categoryInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindCategoryByName($this->branchId(), $in['name'], $id);
        if ($dup) return $this->duplicated($dup, 'una categoría con ese nombre');

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateCategory([
                'values' => ['name', 'description', 'icon', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['name'], $in['description'], $in['icon'], $id]
            ]), 'editCategory');

            return $this->ok('Categoría actualizada.');
        }, 'No se pudo guardar la categoría.');
    }

    public function statusCategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qGetCategory($id, $this->branchId())) return $this->fail(404, 'La categoría no existe.');

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateCategory([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusCategory');

            return $this->ok($active === 1 ? 'Categoría activada.' : 'Categoría desactivada.');
        }, 'No se pudo cambiar el estado de la categoría.');
    }

    // -- Auxiliares --

    // Devuelve ['name','description','icon'] o una respuesta de error (trae 'status'). icon null = automático.
    private function categoryInput() {
        $name        = $this->nameInput();
        $description = $this->textOrNull('description');
        $icon        = $this->textOrNull('icon');

        if ($name === '')                       return $this->fail(400, 'Escribe el nombre de la categoría.');
        if ($this->tooLong($name, 255))         return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($description, 1000)) return $this->fail(400, 'La descripción admite hasta 1000 caracteres.');

        if ($icon !== null && !isset($this->categoryIcons()[$icon])) {
            return $this->fail(400, 'El ícono elegido no es válido.');
        }

        return ['name' => $name, 'description' => $description, 'icon' => $icon];
    }

    // -- Ícono --

    /*  Íconos que se pueden elegir: nombre Lucide => [etiqueta, trazos SVG].
        Lista fija: el POS los pinta con Lucide y la tienda en línea con sus
        propios trazos (ICONS de order/src/js/pedir.js); uno nuevo aquí también
        va allá. Trazos copiados de pro/assets/plugins/lucide/lucide.min.js. */
    private function categoryIcons() {
        return [
            'cake'           => ['Pastel', '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>'],
            'cake-slice'     => ['Rebanada', '<path d="M16 13H3"/><path d="M16 17H3"/><path d="m7.2 7.9-3.388 2.5A2 2 0 0 0 3 12.01V20a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-8.654c0-2-2.44-6.026-6.44-8.026a1 1 0 0 0-1.082.057L10.4 5.6"/><circle cx="9" cy="7" r="2"/>'],
            'cookie'         => ['Galleta', '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>'],
            'croissant'      => ['Pan', '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>'],
            'dessert'        => ['Postre', '<path d="M10.162 3.167A10 10 0 0 0 2 13a2 2 0 0 0 4 0v-1a2 2 0 0 1 4 0v4a2 2 0 0 0 4 0v-4a2 2 0 0 1 4 0v1a2 2 0 0 0 4-.006 10 10 0 0 0-8.161-9.826"/><path d="M20.804 14.869a9 9 0 0 1-17.608 0"/><circle cx="12" cy="4" r="2"/>'],
            'ice-cream-cone' => ['Helado', '<path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>'],
            'sandwich'       => ['Bocadillo', '<path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777"/><path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25"/><path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9"/><path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"/><rect width="20" height="4" x="2" y="11" rx="1"/>'],
            'pizza'          => ['Pizza', '<path d="m12 14-1 1"/><path d="m13.75 18.25-1.25 1.42"/><path d="M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12"/><path d="M18.8 9.3a1 1 0 0 0 2.1 7.7"/><path d="M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z"/>'],
            'utensils'       => ['Platillo', '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'],
            'coffee'         => ['Café', '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>'],
            'cup-soda'       => ['Bebida', '<path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/>'],
            'wine'           => ['Vino', '<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>'],
            'gift'           => ['Regalo', '<path d="M12 7v14"/><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/><rect x="3" y="7" width="18" height="4" rx="1"/>'],
            'sparkles'       => ['Decoración', '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>'],
            'clipboard-list' => ['Pedido especial', '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'],
            'package'        => ['Otros', '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>']
        ];
    }

    /*  El automático: las mismas reglas de OrderForm.categoryIcon
        (order/src/js/pedido-captura.js) y de CAT_ICONS (pedir.js). Si cambian
        allá, cambian aquí. Sin coincidencia: package. */
    private function autoRules() {
        return [
            ['porci', 'cake-slice'],
            ['pastel', 'cake'],
            ['galleta', 'cookie'],
            ['\\bpan\\b', 'croissant'],
            ['postre', 'dessert'],
            ['bocadillo', 'sandwich'],
            ['charola', 'utensils'],
            ['decora', 'sparkles'],
            ['pedido', 'clipboard-list'],
            ['bebida|caf', 'cup-soda']
        ];
    }

    // El que verá el POS: el elegido o el automático por el nombre (sin acentos, en minúsculas).
    private function iconFor($item) {
        $icon = trim((string) $item['icon']);

        if ($icon !== '' && isset($this->categoryIcons()[$icon])) return $icon;

        $text = strtr(mb_strtolower((string) $item['name'], 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);

        foreach ($this->autoRules() as [$pattern, $name]) {
            if (preg_match('/' . $pattern . '/u', $text)) return $name;
        }

        return 'package';
    }

    private function iconSvg($name, $size = 18) {
        $icons = $this->categoryIcons();
        $paths = isset($icons[$name]) ? $icons[$name][1] : $icons['package'][1];

        return '<svg xmlns="http://www.w3.org/2000/svg" width="' . (int) $size . '" height="' . (int) $size . '" viewBox="0 0 24 24" fill="none"'
             . ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths . '</svg>';
    }

    /*  Distintivo con el ícono y el nombre. Elegido: color de la marca.
        Automático: gris (.cp-cat-badge en catalogo.css). */
    private function categoryCell($item) {
        $chosen = trim((string) $item['icon']) !== '';
        $label  = $chosen ? 'Ícono elegido' : 'Ícono automático, según el nombre';

        return '<div class="flex items-center gap-3">'
            . '<span class="cp-pm-badge cp-cat-badge' . ($chosen ? ' is-chosen' : '') . '" role="img" aria-label="' . $label . '" title="' . $label . '">'
            . $this->iconSvg($this->iconFor($item))
            . '</span>'
            . '<div class="min-w-0">' . cellTitle($item['name']) . '</div>'
            . '</div>';
    }

    private function shortDescription($text) {
        $text = trim((string) $text);

        if ($text === '') return '<span class="cp-celda-sub">—</span>';

        return h(mb_strlen($text, 'UTF-8') > 90 ? mb_substr($text, 0, 90, 'UTF-8') . '…' : $text);
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
