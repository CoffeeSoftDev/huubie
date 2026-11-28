<?php
require_once __DIR__ . '/core-inventarios.php';

/*  Base de las pestañas del Catálogo de insumos (Inventarios › sección
    inv-catalogo). Una pestaña = un ctrl que extiende esta clase, como el
    Catálogo de venta (catalogo/ctrl/core-catalogo.php), con su mismo estilo:
    las celdas y los botones de la fila usan catalogo.css de ese módulo.

    Nada se borra: se da de baja (active = 0) y se reactiva desde «Inactivos».

    Casillas de inv-catalogo: show (ver), create (alta), update (editar),
    delete (dar de baja y reactivar), ver-costos (último costo del insumo). */
class coreCatalogo extends core {

    const SECTION = 'inv-catalogo';

    // -- Permisos --

    protected function needShow() {
        return $this->needBranch() ?: $this->need('show', 'ver el catálogo');
    }

    // Con id: editar. Sin id: dar de alta.
    protected function needSave($id) {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $id > 0 ? $this->need('update', 'editar el catálogo') : $this->need('create', 'dar de alta en el catálogo');
    }

    protected function needStatus() {
        return $this->needBranch() ?: $this->need('delete', 'dar de baja en el catálogo');
    }

    // Dueño o root: manejan los almacenes de todas las sucursales y eligen el principal.
    protected function isAdmin() {
        return !empty($_SESSION['is_owner']) || !empty($_SESSION['is_root']);
    }

    // -- Lectura del POST --

    protected function activeFilter() {
        return $this->post('active', '1') === '0' ? 0 : 1;
    }

    // Texto obligatorio, sin espacios de más. '' = la respuesta de error.
    protected function requiredText($key, $label, $max) {
        $value = mb_substr(trim(preg_replace('/\s+/u', ' ', $this->post($key))), 0, $max, 'UTF-8');

        return $value === '' ? $this->fail(400, "Escribe {$label}.") : $value;
    }

    protected function color($key, $default) {
        $value = $this->post($key);

        return preg_match('/^#[0-9A-Fa-f]{6}$/', $value) ? strtoupper($value) : $default;
    }

    // Un nombre de ícono de Lucide (heart, chef-hat...). Vacío = sin ícono.
    protected function icon() {
        $value = strtolower(trim($this->post('icon')));

        return preg_match('/^[a-z0-9-]{1,40}$/', $value) ? $value : null;
    }

    // COMPRA_SP a partir de «Compra sin proveedor», sin repetirse en la empresa.
    protected function codeFrom($table, $name) {
        $base = strtr(mb_strtoupper($name, 'UTF-8'), ['Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N']);
        $base = substr(trim(preg_replace('/[^A-Z0-9]+/', '_', $base), '_'), 0, 24) ?: 'TIPO';
        $code = $base;

        for ($n = 2; $this->qCatalogTaken($table, 'code', $code, $this->companyId(), 0); $n++) $code = $base . '_' . $n;

        return $code;
    }

    // -- Almacenes --

    // Los que se pueden tocar: los de la sucursal, o todos si es Dueño o root (activos y de baja).
    protected function manageableWarehouseIds() {
        $branch = $this->isAdmin() ? null : $this->branchId();
        $rows   = array_merge(
            $this->qWarehouseRows($this->companyId(), 1, $branch),
            $this->qWarehouseRows($this->companyId(), 0, $branch)
        );

        return array_map('intval', array_column($rows, 'id'));
    }

    // -- Contadores de las pestañas --

    protected function countOf($tab) {
        $company = $this->companyId();

        switch ($tab) {
            case 'productos':     return count($this->qProductRows($company, $this->branchId(), $this->mainBranchId()));
            case 'insumos':       return count($this->qSupplyRows($company, $this->branchId(), $this->mainBranchId(), 1));
            case 'grupos':        return $this->qCountActive('supply_group', $company);
            case 'unidades':      return $this->qCountActive('unit', $company);
            case 'almacenes':     return count($this->qWarehouseRows($company, 1, $this->isAdmin() ? null : $this->branchId()));
            case 'areas':         return count($this->qAreaRows($this->manageableWarehouseIds(), 1));
            case 'proveedores':   return $this->qCountActive('supplier', $company);
            case 'tiposEntrada':  return $this->qCountActive('inflow_origin', $company);
            case 'motivosSalida': return $this->qCountActive('outflow_reason', $company);
            case 'estados':       return $this->qCountActive('transfer_status', $company);
            case 'estadosReq':    return $this->qCountActive('requisition_status', $company);
            case 'departamentos': return $this->qCountActive('department', $company);
        }

        return 0;
    }

    // La respuesta de cualquier ls: filas y el número de la pestaña.
    protected function listed($tab, array $row) {
        return ['status' => 200, 'row' => $row, 'count' => $this->countOf($tab)];
    }

    // -- Foto (la misma del Catálogo de venta: foto-producto.js) --
    /*  Viaja como dataURL en image_b64 (ya achicada en el navegador);
        image_remove = 1 la quita. Sin tocarla, los dos llegan vacíos y se queda.
        Se guarda en pro_files/<empresa>/<sucursal>/inventarios/<carpeta>/. */

    // ['b64' => dataURL o '', 'remove' => bool], o la respuesta de error.
    protected function photoInput() {
        $b64 = isset($_POST['image_b64']) ? (string) $_POST['image_b64'] : '';

        if ($b64 !== '' && !$this->decodePhoto($b64)) {
            return $this->fail(400, 'La foto debe ser una imagen JPG, PNG o WEBP de hasta 5 MB.');
        }

        return ['b64' => $b64, 'remove' => $this->flag('image_remove') === 1];
    }

    // Foto nueva: su ruta. Quitar: null. Sin cambios: la que ya tenía.
    protected function nextPhoto($id, $photo, $currentPath, $folder) {
        if ($photo['b64'] !== '') return $this->writePhoto($id, $photo['b64'], $folder);
        if ($photo['remove'])     return null;

        return $currentPath;
    }

    // Borra del disco la que dejó de usar: solo si es de pro y ningún otro la usa.
    protected function dropPhoto($path, $id) {
        $path = trim((string) $path);

        if (strpos($path, 'pro_files/') !== 0 || strpos($path, '..') !== false) return;
        if ($this->qCountItemsWithImage($path, $id) > 0) return;

        $root = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']), '/') : '';
        $file = $root . '/' . $path;

        if (is_file($file)) @unlink($file);
    }

    /*  La foto de la celda (48 px, .cp-foto) o el cuadro vacío con $icon. Si la
        copia local no la tiene, productPhotoError() la busca en producción. */
    protected function photoCell($path, $icon) {
        $src   = $this->photoUrl($path);
        $empty = '<div class="cp-foto cp-foto-vacia"><i class="' . h($icon) . '"></i></div>';

        if ($src === '') return $empty;

        return '<img src="' . h($src) . '" alt="" loading="lazy" class="cp-foto" data-icon="' . h($icon) . '" onerror="productPhotoError(this)">';
    }

    // Foto, nombre y debajo lo que se pase en $meta («SKU · De la Matriz»).
    protected function itemCell($name, $image, $icon, array $meta) {
        $meta = array_filter($meta, function ($m) { return $m !== null && $m !== ''; });

        return '<div class="flex items-center gap-3">'
             . $this->photoCell($image, $icon)
             . '<div class="min-w-0"><div class="cp-celda-titulo">' . h($name) . '</div>'
             . ($meta ? '<div class="cp-celda-sub">' . h(implode(' · ', $meta)) . '</div>' : '')
             . '</div></div>';
    }

    // -- Celdas (las del Catálogo de venta, catalogo.css) --

    // Botón cuadrado: '' normal, 'warn' Dar de baja, 'ok' Activar.
    protected function actionBtnClass($variant = '') {
        return 'cp-btn-icon' . ($variant !== '' ? ' cp-btn-icon--' . $variant : '');
    }

    /*  Ícono Lucide ya dibujado: con <i data-lucide> las filas de la página 2
        en adelante salían vacías (DataTables las saca del documento antes de
        lucide.createIcons). */
    protected function lucideSvg($name) {
        $paths = [
            'pencil'       => '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
            'toggle-right' => '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/>',
            'toggle-left'  => '<rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="8" cy="12" r="2"/>'
        ];

        return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
             . ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths[$name] . '</svg>';
    }

    /*  Lápiz (con la casilla editar) y dar de baja / activar (con la casilla
        delete). $jsObj: la global de la pestaña ('grupos'). aria-label y no
        title: en este framework title dispara un popover. */
    protected function rowActions($jsObj, $id, $active, $canStatus = true) {
        $on = (int) $active === 1;
        $a  = [];

        if ($on && $this->can('update')) {
            $a[] = [
                'class'      => $this->actionBtnClass(),
                'html'       => $this->lucideSvg('pencil'),
                'aria-label' => 'Editar',
                'onclick'    => "{$jsObj}.edit({$id})"
            ];
        }

        if ($canStatus && $this->can('delete')) {
            $a[] = [
                'class'      => $this->actionBtnClass($on ? 'warn' : 'ok'),
                'html'       => $this->lucideSvg($on ? 'toggle-right' : 'toggle-left'),
                'aria-label' => $on ? 'Dar de baja' : 'Activar',
                'onclick'    => "{$jsObj}.status({$id}, " . ($on ? 0 : 1) . ')'
            ];
        }

        return $a ?: $this->noActions();
    }

    /*  Fila sin botones: un hueco del tamaño de uno. La tabla solo pinta la
        celda de botones si trae alguno; sin ella la fila queda con una
        columna menos y DataTables la rechaza. */
    protected function noActions() {
        return [['class' => 'inline-block w-[30px] h-[30px]', 'aria-hidden' => 'true']];
    }

    protected function activeCell($active) {
        $base = 'px-2 py-1 rounded-md text-sm font-semibold ';

        return (int) $active === 1
            ? '<span class="' . $base . 'bg-emerald-50 text-emerald-700">Activo</span>'
            : '<span class="' . $base . 'bg-red-50 text-red-700">Inactivo</span>';
    }

    protected function systemCell() {
        return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-slate-100 text-slate-600">Sistema</span>';
    }

    protected function chip($text, $tone = 'slate') {
        $tones = [
            'slate'   => 'bg-slate-100 text-slate-600',
            'emerald' => 'bg-emerald-50 text-emerald-700',
            'amber'   => 'bg-amber-50 text-amber-700',
            'sky'     => 'bg-sky-50 text-sky-700',
            'violet'  => 'bg-violet-50 text-violet-700',
            'red'     => 'bg-red-50 text-red-700'
        ];

        return '<span class="cp-chip ' . ($tones[$tone] ?? $tones['slate']) . '">' . h($text) . '</span>';
    }

    protected function cellTitle($title, $sub = '') {
        $html = '<div class="cp-celda-titulo">' . h($title) . '</div>';

        return ($sub === null || $sub === '') ? $html : $html . '<div class="cp-celda-sub">' . h($sub) . '</div>';
    }

    // La existencia: en el mínimo o debajo, en ámbar; en cero o menos, en rojo.
    protected function stockCell($qty, $min) {
        $text = h($this->num($qty));

        if ($qty <= 0)                return $this->chip($text, 'red');
        if ($min > 0 && $qty <= $min) return $this->chip($text, 'amber');

        return $text;
    }

    protected function dash() {
        return '<span class="cp-celda-sub">—</span>';
    }

    protected function yesNo($value) {
        return (int) $value === 1 ? $this->chip('Sí', 'emerald') : '<span class="cp-celda-sub">No</span>';
    }

    protected function codeCell($code) {
        return '<span class="inline-block px-2 py-0.5 rounded border border-gray-200 bg-gray-100 font-mono text-gray-600">' . h($code) . '</span>';
    }

    protected function shortText($text, $max = 90) {
        $text = trim((string) $text);

        if ($text === '') return $this->dash();

        return h(mb_strlen($text, 'UTF-8') > $max ? mb_substr($text, 0, $max, 'UTF-8') . '…' : $text);
    }
}
