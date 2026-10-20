<?php
// Qué productos ve y edita cada sucursal (18/10/2026).
// Cada producto es de una sucursal (item.branch_id). La Matriz es la sucursal del almacén
// principal (warehouse.is_main, Catálogo › Almacenes):
// - sus productos las demás sucursales solo los piden o los compran (Pedidos, Compras y
//   Entradas); en sus pantallas cada una ve los suyos y lo que tiene en sus almacenes
//   (19/10/2026). Solo Matriz los edita;
// - los de una sucursal los ve y los edita esa sucursal;
// - Matriz y el administrador (dueño o rol Super Admin / Dueño) ven y editan los de todas;
//   el administrador además los cambia de sucursal en Catálogo › Productos.
// Sin almacén principal marcado, todos ven y editan todo, como antes.
// También: en qué almacenes mete y saca cada quien, qué áreas ve cada sucursal y los
// catálogos por sucursal (categorías, proveedores, almacenes y áreas).
// Lo usan mdl-almacen, mdl-entradas, mdl-salidas, mdl-ordenes y mdl-stock.

trait VisibilidadProductos {

    private $matrizBranch = false;

    // Sucursal del almacén principal de la empresa; null si no hay ninguno marcado.
    function getMatrizBranch() {
        if ($this->matrizBranch === false) {
            $r = $this->_Read("
                SELECT branch_id
                FROM {$this->bd}warehouse
                WHERE is_main = 1 AND active = 1 AND companies_id = ?
                LIMIT 1
            ", [(int) ($_SESSION['company_id'] ?? 0)]);

            $this->matrizBranch = !empty($r[0]['branch_id']) ? (int) $r[0]['branch_id'] : null;
        }

        return $this->matrizBranch;
    }

    // Administrador: el dueño (is_owner) o un rol Super Admin / Dueño (is_admin, login).
    // Ve y edita los productos de todas las sucursales y puede cambiarlos de sucursal.
    function esAdministrador() {
        return (int) ($_SESSION['is_owner'] ?? 0) === 1 || (int) ($_SESSION['is_admin'] ?? 0) === 1;
    }

    // Ve y edita todos los productos: el administrador, quien trabaja en Matriz, o todos si
    // la empresa no tiene almacén principal.
    function veTodosLosProductos() {
        $matriz = $this->getMatrizBranch();

        return $this->esAdministrador()
            || $matriz === null
            || (int) ($_SESSION['branch_id'] ?? 0) === $matriz;
    }

    // Condición sobre el alias del producto: los de su sucursal y los de Matriz. '' si ve
    // todo. Los ids son enteros, así que van en el texto de la consulta.
    function filtroProductosVisibles($alias = 'i') {
        if ($this->veTodosLosProductos()) return '';

        $suya   = (int) ($_SESSION['branch_id'] ?? 0);
        $matriz = (int) $this->getMatrizBranch();

        return " AND ({$alias}.branch_id IN ({$suya}, {$matriz}) OR {$alias}.branch_id IS NULL)";
    }

    // Lo que ve una sucursal que no es Matriz en sus pantallas (Catálogo, Salidas, Stock,
    // Conteo físico): solo sus productos y los que ya están en sus almacenes (le llegaron
    // de un pedido o de una compra). Los de Matriz los ve solo para pedirlos o comprarlos
    // (filtroProductosVisibles en Pedidos, Compras y Entradas). '' si ve todo.
    // `$branchId`: la regla de esa sucursal en lugar de la sesión (la hoja de un conteo).
    function filtroProductosPropios($alias = 'i', $branchId = null) {
        $matriz = $this->getMatrizBranch();

        if ($branchId === null) {
            if ($this->veTodosLosProductos()) return '';
            $suya = (int) ($_SESSION['branch_id'] ?? 0);
        } else {
            if ($matriz === null || (int) $branchId === $matriz) return '';
            $suya = (int) $branchId;
        }

        return " AND ({$alias}.branch_id = {$suya} OR {$alias}.branch_id IS NULL OR {$alias}.id IN ("
             . "SELECT s.item_id FROM {$this->bd}stock s INNER JOIN {$this->bd}warehouse w ON w.id = s.warehouse_id "
             . "WHERE w.branch_id = {$suya} AND s.active = 1))";
    }

    // Solo los que puede editar: los de su sucursal ('' si edita todo).
    function filtroProductosEditables($alias = 'i') {
        if ($this->veTodosLosProductos()) return '';

        return " AND {$alias}.branch_id = " . (int) ($_SESSION['branch_id'] ?? 0);
    }

    function puedeEditarProducto($itemBranchId) {
        return $this->veTodosLosProductos() || (int) $itemBranchId === (int) ($_SESSION['branch_id'] ?? 0);
    }

    // Una sucursal no mete ni saca en el almacén de otra (19/10/2026): el almacén debe ser
    // de una de las sucursales del usuario (users_braches). El dueño, cualquiera de la empresa.
    function almacenDeSusSucursales($warehouseId) {
        $companyId = (int) ($_SESSION['company_id'] ?? 0);

        if ((int) ($_SESSION['is_owner'] ?? 0) === 1) {
            $r = $this->_Read("SELECT id FROM {$this->bd}warehouse WHERE id = ? AND companies_id = ? LIMIT 1", [(int) $warehouseId, $companyId]);
        } else {
            $r = $this->_Read("
                SELECT w.id
                FROM {$this->bd}warehouse w
                INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = w.branch_id AND ub.user_id = ?
                WHERE w.id = ? AND w.companies_id = ?
                LIMIT 1
            ", [(int) ($_SESSION['user_id'] ?? 0), (int) $warehouseId, $companyId]);
        }

        return !empty($r);
    }

    // -- Catálogos por sucursal (19/10/2026) --
    // Categorías, proveedores, almacenes y áreas son de una sucursal: cada una, Matriz
    // incluida, ve los suyos; el administrador ve los de todas o los de la sucursal que
    // elija en el selector de su pestaña (`$clave` del POST; '' = todas). Lo que no tiene
    // sucursal (empresa sin almacén principal) lo ven todas.

    // null = todas (solo el administrador). Quien tiene varias sucursales elige una de las
    // suyas en el selector; sin elegir, la de la sesión.
    function sucursalDeCatalogo($clave = null) {
        if (!$this->esAdministrador()) {
            return $clave === null ? (int) ($_SESSION['branch_id'] ?? 0) : $this->sucursalPropiaElegida($clave);
        }

        $elegida = $clave !== null ? (string) ($_POST[$clave] ?? '') : '';
        return $elegida === '' ? null : (int) $elegida;
    }

    function filtroCatalogoSucursal($alias, $clave = null) {
        return $this->filtroCatalogoDe($alias, $this->sucursalDeCatalogo($clave));
    }

    // Lo de una sucursal fija (null = sin filtro).
    function filtroCatalogoDe($alias, $suya) {
        return $suya === null ? '' : " AND ({$alias}.branch_id = " . (int) $suya . " OR {$alias}.branch_id IS NULL)";
    }

    // A quién le nace lo que se da de alta: la sucursal elegida por el administrador o la
    // de la sesión.
    function sucursalNuevaCatalogo($clave = null) {
        return $this->sucursalDeCatalogo($clave) ?? (int) ($_SESSION['branch_id'] ?? 0);
    }

    // Las áreas cuelgan de su almacén: las de los almacenes de esa sucursal.
    function filtroAreasCatalogo($alias, $clave = null) {
        return $this->filtroAreasDe($alias, $this->sucursalDeCatalogo($clave));
    }

    function filtroAreasDe($alias, $suya) {
        return $suya === null ? '' : " AND ({$alias}.warehouse_id IN (SELECT id FROM {$this->bd}warehouse WHERE branch_id = " . (int) $suya . ") OR {$alias}.warehouse_id IS NULL)";
    }

    // -- Selector de quien tiene varias sucursales (19/10/2026) --
    // Quien no es administrador pero tiene asignada más de una sucursal (users_braches) ve
    // en Catálogo el selector con las suyas, sin «Todas»: consulta, da de alta y edita en
    // la que elija. La de la sesión siempre cuenta como suya.

    private $misSucursales = null;

    // [id, valor] de sus sucursales activas; Matriz primero.
    function misSucursales() {
        if ($this->misSucursales === null) {
            $r = $this->_Read("
                SELECT b.id, b.name AS valor
                FROM fayxzvov_erp.branches b
                WHERE b.company_id = ? AND b.is_active = 1
                  AND (b.id = ? OR b.id IN (SELECT branch_id FROM fayxzvov_erp.users_braches WHERE user_id = ?))
                ORDER BY b.id IN (SELECT branch_id FROM {$this->bd}warehouse WHERE is_main = 1 AND active = 1) DESC, b.name ASC
            ", [(int) ($_SESSION['company_id'] ?? 0), (int) ($_SESSION['branch_id'] ?? 0), (int) ($_SESSION['user_id'] ?? 0)]);

            $this->misSucursales = is_array($r) ? $r : [];
        }

        return $this->misSucursales;
    }

    function esDeMisSucursales($branchId) {
        return in_array((int) $branchId, array_map('intval', array_column($this->misSucursales(), 'id')), true);
    }

    // La que mandó el selector `$clave` si es una de las suyas; si no, la de la sesión.
    function sucursalPropiaElegida($clave) {
        $elegida = (int) ($_POST[$clave] ?? 0);
        return $elegida && $this->esDeMisSucursales($elegida) ? $elegida : (int) ($_SESSION['branch_id'] ?? 0);
    }

    // Condición sobre el alias: lo de sus sucursales. '' para el administrador.
    function filtroMisSucursales($alias, $columna = 'branch_id') {
        if ($this->esAdministrador()) return '';

        $ids = array_map('intval', array_column($this->misSucursales(), 'id')) ?: [(int) ($_SESSION['branch_id'] ?? 0)];
        return " AND {$alias}.{$columna} IN (" . implode(',', $ids) . ")";
    }

    // ¿La categoría es de esa sucursal (o de toda la empresa)? Al mover un producto de
    // sucursal, la de otra se le quita.
    function categoriaEsDeSucursal($categoryId, $branchId) {
        if (empty($categoryId)) return true;

        $r = $this->_Read("
            SELECT 1 FROM {$this->bd}item_category
            WHERE id = ? AND (branch_id = ? OR branch_id IS NULL)
            LIMIT 1
        ", [(int) $categoryId, (int) $branchId]);

        return !empty($r);
    }

    // Áreas de los almacenes de una sucursal (y las que no tienen almacén), para los
    // selects de Productos y del formulario de un producto de esa sucursal.
    function areasDeSucursal($branchId) {
        $r = $this->_Read("
            SELECT wa.id, wa.name AS valor, wa.color_hex, wa.description
            FROM {$this->bd}warehouse_area wa
            WHERE wa.active = 1 AND wa.companies_id = ?
              AND (wa.warehouse_id IN (SELECT id FROM {$this->bd}warehouse WHERE branch_id = ?) OR wa.warehouse_id IS NULL)
            ORDER BY wa.name ASC
        ", [(int) ($_SESSION['company_id'] ?? 0), (int) $branchId]);

        return is_array($r) ? $r : [];
    }

    // Categorías de una sucursal, para el formulario de un producto de esa sucursal.
    function categoriasDeSucursal($branchId) {
        $r = $this->_Read("
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1 AND companies_id = ? AND (branch_id = ? OR branch_id IS NULL)
            ORDER BY name ASC
        ", [(int) ($_SESSION['company_id'] ?? 0), (int) $branchId]);

        return is_array($r) ? $r : [];
    }

    // ¿El área es de un almacén de esa sucursal? Al mover un producto de sucursal, el área
    // de otra se le quita.
    function areaEsDeSucursal($areaId, $branchId) {
        if (empty($areaId)) return true;

        $r = $this->_Read("
            SELECT 1
            FROM {$this->bd}warehouse_area wa
            INNER JOIN {$this->bd}warehouse w ON w.id = wa.warehouse_id
            WHERE wa.id = ? AND w.branch_id = ?
            LIMIT 1
        ", [(int) $areaId, (int) $branchId]);

        return !empty($r);
    }

    // Áreas que ve la sucursal (A1, 19/10/2026): las de los almacenes de su sucursal y las
    // que no tienen almacén. Matriz, el dueño o una empresa sin principal ven todas.
    function filtroAreasVisibles($alias = 'wa') {
        if ($this->veTodosLosProductos()) return '';

        $suya = (int) ($_SESSION['branch_id'] ?? 0);
        return " AND ({$alias}.warehouse_id IN (SELECT id FROM {$this->bd}warehouse WHERE branch_id = {$suya}) OR {$alias}.warehouse_id IS NULL)";
    }
}
