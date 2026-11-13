<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Subcategorías: por sucursal, cada una cuelga de una categoría.
class ctrl extends core {

    // Opciones del filtro: categorías activas de la sucursal.
    public function init() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => []]);

        return ['status' => 200, 'categories' => $this->qCategoryOptions($this->branchId())];
    }

    // Opciones del modal. keep_id conserva la categoría actual aunque esté inactiva.
    public function formOptions() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => []]);

        return [
            'status'     => 200,
            'categories' => $this->qCategoryOptions($this->branchId(), $this->postId('keep_id'))
        ];
    }

    public function lsSubcategories() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $branch   = $this->branchId();
        $category = $this->selectOrNull('category_id');
        $row      = [];

        foreach ($this->qListSubcategories($branch, $this->activeFilter(), $category) as $item) {
            $id = (int) $item['id'];

            $row[] = [
                'id'           => $id,
                'Subcategoría' => cellTitle($item['name']),
                'Categoría'    => $this->categoryCell($item),
                'Descripción'  => $this->shortDescription($item['description']),
                'Productos'    => (int) $item['products'],
                'Estado'       => renderActive($item['active']),
                'a'            => $this->rowActions('subcategories', $id, $item['active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountSubcategories($branch)];
    }

    public function getSubcategory() {
        $data = $this->qGetSubcategory($this->postId(), $this->branchId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'La subcategoría no existe.');
    }

    public function addSubcategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $in = $this->subcategoryInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindSubcategoryByName($in['category_id'], $in['name']);
        if ($dup) return $this->duplicated($dup, 'una subcategoría con ese nombre en esa categoría');

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateSubcategory([
                'values' => ['name', 'description', 'branch_id', 'category_id', 'active'],
                'data'   => [$in['name'], $in['description'], $this->branchId(), $in['category_id'], 1]
            ]), 'addSubcategory');

            return $this->ok('Subcategoría creada.');
        }, 'No se pudo guardar la subcategoría.');
    }

    public function editSubcategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetSubcategory($id, $this->branchId());

        if (!$current) return $this->fail(404, 'La subcategoría no existe.');

        $in = $this->subcategoryInput((int) $current['category_id']);
        if (isset($in['status'])) return $in;

        $dup = $this->qFindSubcategoryByName($in['category_id'], $in['name'], $id);
        if ($dup) return $this->duplicated($dup, 'una subcategoría con ese nombre en esa categoría');

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateSubcategory([
                'values' => ['category_id', 'name', 'description', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['category_id'], $in['name'], $in['description'], $id]
            ]), 'editSubcategory');

            return $this->ok('Subcategoría actualizada.');
        }, 'No se pudo guardar la subcategoría.');
    }

    public function statusSubcategory() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        if (!$this->qGetSubcategory($id, $this->branchId())) return $this->fail(404, 'La subcategoría no existe.');

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateSubcategory([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusSubcategory');

            return $this->ok($active === 1 ? 'Subcategoría activada.' : 'Subcategoría desactivada.');
        }, 'No se pudo cambiar el estado de la subcategoría.');
    }

    // -- Auxiliares --

    // Devuelve los campos listos o una respuesta de error (trae 'status').
    // $currentCategory: la que ya tenía al editar; esa se acepta aunque esté inactiva.
    private function subcategoryInput($currentCategory = 0) {
        $categoryId  = $this->selectOrNull('category_id');
        $name        = $this->nameInput();
        $description = $this->textOrNull('description');

        if ($categoryId === null)              return $this->fail(400, 'Elige la categoría de la subcategoría.');
        if ($name === '')                      return $this->fail(400, 'Escribe el nombre de la subcategoría.');
        if ($this->tooLong($name, 80))         return $this->fail(400, 'El nombre admite hasta 80 caracteres.');
        if ($this->tooLong($description, 255)) return $this->fail(400, 'La descripción admite hasta 255 caracteres.');

        $problem = $this->categoryProblem($categoryId, $currentCategory);
        if ($problem) return $problem;

        return ['category_id' => $categoryId, 'name' => $name, 'description' => $description];
    }

    // La categoría puede faltar (se borró) o estar inactiva: se avisa en la celda.
    private function categoryCell($item) {
        if ($item['category'] === null) return '<span class="cp-celda-sub">—</span>';

        $html = h($item['category']);

        return (int) $item['category_active'] === 0 ? $html . ' ' . chip('Inactiva', 'red') : $html;
    }

    private function shortDescription($text) {
        $text = trim((string) $text);

        if ($text === '') return '<span class="cp-celda-sub">—</span>';

        return h(mb_strlen($text, 'UTF-8') > 90 ? mb_substr($text, 0, 90, 'UTF-8') . '…' : $text);
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
