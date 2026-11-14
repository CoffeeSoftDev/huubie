<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Categorías: cada categoria es de una sucursal.
class ctrl extends core {

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
                'Categoría'     => cellTitle($item['name']),
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
                'values' => ['name', 'description', 'branch_id', 'active'],
                'data'   => [$in['name'], $in['description'], $this->branchId(), 1]
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
                'values' => ['name', 'description', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['name'], $in['description'], $id]
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

    // Devuelve ['name','description'] o una respuesta de error (trae 'status').
    private function categoryInput() {
        $name        = $this->nameInput();
        $description = $this->textOrNull('description');

        if ($name === '')                       return $this->fail(400, 'Escribe el nombre de la categoría.');
        if ($this->tooLong($name, 255))         return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($description, 1000)) return $this->fail(400, 'La descripción admite hasta 1000 caracteres.');

        return ['name' => $name, 'description' => $description];
    }

    private function shortDescription($text) {
        $text = trim((string) $text);

        if ($text === '') return '<span class="cp-celda-sub">—</span>';

        return h(mb_strlen($text, 'UTF-8') > 90 ? mb_substr($text, 0, 90, 'UTF-8') . '…' : $text);
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
