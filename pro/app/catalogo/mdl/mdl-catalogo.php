<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  Modelo del Catalogo.

    Dos bases en el mismo servidor:
      fayxzvov_app  (la del .env) empresas y sucursales. Sin prefijo: $this->bd.
      fayxzvov_pos  el catalogo. Con prefijo: $this->pos.

    Alcance de cada tabla:
      category, subcategory      por sucursal (branch_id).
      product (y paquetes)       por empresa y sucursal. is_custom = 1 es el
                                 pastel de un pedido: aqui no sale.
      modifier_group,
      payment_method,
      discount_reason            por empresa. company_id NULL = plantilla de
                                 Huubie: la ven todas y nadie la edita.
      modifier                   cuelga de su grupo y hereda su alcance.

    "Activo" se lee con IFNULL(active, 1): un NULL cuenta como activo.
    Los nombres se comparan con TRIM(name) = ?: la collation
    utf8mb4_general_ci ya ignora mayusculas y acentos. */
class mdl extends CRUD {
    public $util;
    public $bd;
    public $pos;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = '';
        $this->pos  = 'fayxzvov_pos.';
    }

    // -- Ayudantes --

    protected function qRows($query, $data = []) {
        $sql = $this->_Read($query, $data);
        return is_array($sql) ? $sql : [];
    }

    protected function qRow($query, $data = []) {
        $sql = $this->qRows($query, $data);
        return empty($sql) ? null : $sql[0];
    }

    protected function qCount($query, $data = []) {
        $row = $this->qRow($query, $data);
        return $row === null ? 0 : (int) reset($row);
    }

    // '?,?,?' para un IN (...). Nunca con un arreglo vacio.
    protected function qIn(array $ids) {
        return implode(',', array_fill(0, count($ids), '?'));
    }

    // ['values' => [...], 'data' => [...]] sobre una tabla del POS.
    protected function qInsertInto($table, $array) {
        return $this->_Insert([
            'table'  => $this->pos . $table,
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // ['values' => [...], 'where' => [...], 'data' => [...]] sobre una tabla del POS.
    protected function qUpdateIn($table, $array) {
        return $this->_Update([
            'table'  => $this->pos . $table,
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Solo dentro de transaction(): fuera, _CUD ya cerro la conexion.
    public function qLastInsertId() {
        return (int) $this->mysql->lastInsertId();
    }

    // -- Empresa y sucursal (fayxzvov_app) --

    public function qFirstCompany() {
        return $this->qRow("
            SELECT id, name
            FROM {$this->bd}companies
            ORDER BY (status = 'active') DESC, id
            LIMIT 1
        ");
    }

    public function qCompany($id) {
        return $this->qRow("SELECT id, name FROM {$this->bd}companies WHERE id = ? LIMIT 1", [$id]);
    }

    public function qFirstBranch($companyId) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE company_id = ?
                AND IFNULL(is_active, 1) = 1
            ORDER BY id
            LIMIT 1
        ", [$companyId]);
    }

    public function qBranch($id) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE id = ?
                AND IFNULL(is_active, 1) = 1
            LIMIT 1
        ", [$id]);
    }

    // -- Categorias (por sucursal) --

    public function qListCategories($branchId, $active) {
        return $this->qRows("
            SELECT
                c.id,
                c.name,
                c.description,
                IFNULL(c.active, 1) AS active,
                (SELECT COUNT(*) FROM {$this->pos}subcategory s
                  WHERE s.category_id = c.id
                    AND IFNULL(s.active, 1) = 1) AS subcategories,
                (SELECT COUNT(*) FROM {$this->pos}product p
                  WHERE p.category_id = c.id
                    AND IFNULL(p.is_custom, 0) = 0
                    AND IFNULL(p.active, 1) = 1) AS products
            FROM {$this->pos}category c
            WHERE c.branch_id = ?
                AND IFNULL(c.active, 1) = ?
            ORDER BY c.name
        ", [$branchId, $active]);
    }

    public function qGetCategory($id, $branchId) {
        return $this->qRow("
            SELECT id, name, description, IFNULL(active, 1) AS active
            FROM {$this->pos}category
            WHERE id = ?
                AND branch_id = ?
            LIMIT 1
        ", [$id, $branchId]);
    }

    public function qFindCategoryByName($branchId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, IFNULL(active, 1) AS active
            FROM {$this->pos}category
            WHERE branch_id = ?
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$branchId, $name, $exceptId]);
    }

    public function qCountCategories($branchId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}category
            WHERE branch_id = ?
                AND IFNULL(active, 1) = 1
        ", [$branchId]);
    }

    // Activas, mas $keepId aunque este inactiva: al editar no se pierde la que ya tenia.
    public function qCategoryOptions($branchId, $keepId = 0) {
        return $this->qRows("
            SELECT id, name AS valor
            FROM {$this->pos}category
            WHERE branch_id = ?
                AND (IFNULL(active, 1) = 1 OR id = ?)
            ORDER BY name
        ", [$branchId, $keepId]);
    }

    public function qCreateCategory($array) {
        return $this->qInsertInto('category', $array);
    }

    public function qUpdateCategory($array) {
        return $this->qUpdateIn('category', $array);
    }

    // -- Subcategorias (por sucursal, cuelgan de una categoria) --

    public function qListSubcategories($branchId, $active, $categoryId = null) {
        $where = '';
        $data  = [$branchId, $active];

        if ($categoryId !== null) {
            $where  = 'AND s.category_id = ?';
            $data[] = $categoryId;
        }

        return $this->qRows("
            SELECT
                s.id,
                s.name,
                s.description,
                s.category_id,
                IFNULL(s.active, 1) AS active,
                c.name AS category,
                IFNULL(c.active, 1) AS category_active,
                (SELECT COUNT(*) FROM {$this->pos}product p
                  WHERE p.subcategory_id = s.id
                    AND IFNULL(p.is_custom, 0) = 0
                    AND IFNULL(p.active, 1) = 1) AS products
            FROM {$this->pos}subcategory s
            LEFT JOIN {$this->pos}category c ON c.id = s.category_id
            WHERE s.branch_id = ?
                AND IFNULL(s.active, 1) = ?
                {$where}
            ORDER BY c.name, s.name
        ", $data);
    }

    public function qGetSubcategory($id, $branchId) {
        return $this->qRow("
            SELECT id, name, description, category_id, IFNULL(active, 1) AS active
            FROM {$this->pos}subcategory
            WHERE id = ?
                AND branch_id = ?
            LIMIT 1
        ", [$id, $branchId]);
    }

    // El nombre se repite entre categorias, no dentro de la misma.
    public function qFindSubcategoryByName($categoryId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, IFNULL(active, 1) AS active
            FROM {$this->pos}subcategory
            WHERE category_id = ?
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$categoryId, $name, $exceptId]);
    }

    public function qCountSubcategories($branchId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}subcategory
            WHERE branch_id = ?
                AND IFNULL(active, 1) = 1
        ", [$branchId]);
    }

    // Con category_id: el modal de producto las filtra en el cliente.
    public function qSubcategoryOptions($branchId, $keepId = 0) {
        return $this->qRows("
            SELECT id, name AS valor, category_id
            FROM {$this->pos}subcategory
            WHERE branch_id = ?
                AND (IFNULL(active, 1) = 1 OR id = ?)
            ORDER BY name
        ", [$branchId, $keepId]);
    }

    public function qCreateSubcategory($array) {
        return $this->qInsertInto('subcategory', $array);
    }

    public function qUpdateSubcategory($array) {
        return $this->qUpdateIn('subcategory', $array);
    }

    // -- Productos (kind product | service) --

    /*  Uno ACTIVO con el mismo nombre en la sucursal del ? (no el mismo registro).
        Es la regla de Pedidos (qCatalogProducts): si la sucursal tiene el suyo
        activo, el de la Matriz no se le ofrece. */
    private function qTwinIn($alias) {
        return "
            SELECT 1
            FROM {$this->pos}product t
            WHERE t.company_id = {$alias}.company_id
                AND t.branch_id = ?
                AND t.id <> {$alias}.id
                AND LOWER(TRIM(t.name)) = LOWER(TRIM({$alias}.name))
                AND IFNULL(t.is_custom, 0) = 0
                AND t.kind IN ('product', 'service')
                AND IFNULL(t.active, 1) = 1
        ";
    }

    /*  Los de la sucursal. La categoria se filtra por NOMBRE: en una sucursal la
        misma categoria puede ser suya o de la Matriz (Pedidos tambien agrupa por nombre).
        twin_main: la Matriz tiene uno activo con ese nombre (este lo reemplaza).
        own_elsewhere: cuantas otras sucursales venden el suyo (se lee en la Matriz). */
    public function qListProducts($companyId, $branchId, $active, $categoryName = null, $mainId = 0) {
        $where = '';
        $data  = [$mainId, $companyId, $branchId, $active];

        if ($categoryName !== null) {
            $where  = 'AND TRIM(c.name) = ?';
            $data[] = $categoryName;
        }

        return $this->qRows("
            SELECT
                p.id,
                p.name,
                p.description,
                p.image,
                p.sku,
                p.barcode,
                p.kind,
                p.price,
                p.cost,
                p.sell_pos,
                p.in_catalog,
                p.is_inventoriable,
                p.category_id,
                p.subcategory_id,
                IFNULL(p.active, 1) AS active,
                c.name AS category,
                s.name AS subcategory,
                EXISTS ({$this->qTwinIn('p')}) AS twin_main,
                (SELECT COUNT(DISTINCT o.branch_id)
                   FROM {$this->pos}product o
                  WHERE o.company_id = p.company_id
                    AND o.branch_id <> p.branch_id
                    AND LOWER(TRIM(o.name)) = LOWER(TRIM(p.name))
                    AND IFNULL(o.is_custom, 0) = 0
                    AND o.kind IN ('product', 'service')
                    AND IFNULL(o.active, 1) = 1) AS own_elsewhere
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c    ON c.id = p.category_id
            LEFT JOIN {$this->pos}subcategory s ON s.id = p.subcategory_id
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = ?
                {$where}
            ORDER BY p.name
        ", $data);
    }

    public function qGetProduct($id, $companyId, $branchId) {
        return $this->qRow("
            SELECT
                id, name, description, image, sku, barcode, kind, price, cost,
                sell_pos, in_catalog, is_inventoriable,
                category_id, subcategory_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE id = ?
                AND company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind IN ('product', 'service')
            LIMIT 1
        ", [$id, $companyId, $branchId]);
    }

    // Lo que la sucursal vende de la Matriz: activo y sin uno propio activo con el mismo nombre.
    public function qListMainProducts($companyId, $branchId, $mainId, $categoryName = null) {
        $where = '';
        $data  = [$companyId, $mainId, $branchId];

        if ($categoryName !== null) {
            $where  = 'AND TRIM(c.name) = ?';
            $data[] = $categoryName;
        }

        return $this->qRows("
            SELECT
                p.id,
                p.name,
                p.image,
                p.sku,
                p.kind,
                p.price,
                p.cost,
                p.sell_pos,
                p.in_catalog,
                IFNULL(p.active, 1) AS active,
                c.name AS category,
                s.name AS subcategory
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c    ON c.id = p.category_id
            LEFT JOIN {$this->pos}subcategory s ON s.id = p.subcategory_id
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
                AND NOT EXISTS ({$this->qTwinIn('p')})
                {$where}
            ORDER BY p.name
        ", $data);
    }

    // El de la Matriz que se va a copiar, con todo lo que la copia hereda.
    public function qGetMainProduct($id, $companyId, $mainId) {
        return $this->qRow("
            SELECT
                p.id, p.name, p.description, p.image, p.sku, p.barcode, p.kind, p.unit_id,
                p.price, p.cost, p.portion_qty, p.shelf_life_days,
                p.is_inventoriable, p.sell_pos, p.in_catalog,
                TRIM(c.name)  AS category,
                c.description AS category_description,
                TRIM(s.name)  AS subcategory,
                s.description AS subcategory_description
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c    ON c.id = p.category_id
            LEFT JOIN {$this->pos}subcategory s ON s.id = p.subcategory_id
            WHERE p.id = ?
                AND p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
            LIMIT 1
        ", [$id, $companyId, $mainId]);
    }

    // Filtro de Productos: las categorias activas de la sucursal y de la Matriz, una por nombre.
    public function qFilterCategories($branchId, $mainId) {
        return $this->qRows("
            SELECT MIN(id) AS id, TRIM(name) AS valor
            FROM {$this->pos}category
            WHERE branch_id IN (?, ?)
                AND IFNULL(active, 1) = 1
            GROUP BY TRIM(name)
            ORDER BY valor
        ", [$branchId, $mainId]);
    }

    public function qCategoryName($id, $branchId, $mainId) {
        $row = $this->qRow("
            SELECT TRIM(name) AS name
            FROM {$this->pos}category
            WHERE id = ?
                AND branch_id IN (?, ?)
            LIMIT 1
        ", [$id, $branchId, $mainId]);

        return $row ? $row['name'] : null;
    }

    // Unico entre productos, servicios y paquetes de la sucursal: en el POS se
    // buscan por nombre y dos iguales confunden. Devuelve kind para el mensaje.
    public function qFindProductByName($companyId, $branchId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, kind, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $branchId, $name, $exceptId]);
    }

    public function qFindProductBySku($companyId, $branchId, $sku, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND TRIM(sku) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $branchId, $sku, $exceptId]);
    }

    // El lector de codigo de barras tiene que caer en un solo producto.
    public function qFindProductByBarcode($companyId, $branchId, $barcode, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND TRIM(barcode) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $branchId, $barcode, $exceptId]);
    }

    // Lo que se vende en la sucursal: lo suyo activo y, fuera de la Matriz, lo que hereda de ella.
    public function qCountProducts($companyId, $branchId, $mainId = 0) {
        $own = $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind IN ('product', 'service')
                AND IFNULL(active, 1) = 1
        ", [$companyId, $branchId]);

        if ($mainId <= 0 || $mainId === $branchId) return $own;

        return $own + $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}product p
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
                AND NOT EXISTS ({$this->qTwinIn('p')})
        ", [$companyId, $mainId, $branchId]);
    }

    // Paquetes activos que lo llevan: mientras este en uno no se desactiva.
    public function qCountBundlesWith($productId) {
        return $this->qCount("
            SELECT COUNT(DISTINCT r.product_id)
            FROM {$this->pos}product_recipe r
            INNER JOIN {$this->pos}product b ON b.id = r.product_id
            WHERE r.component_id = ?
                AND IFNULL(r.active, 1) = 1
                AND b.kind = 'bundle'
                AND IFNULL(b.active, 1) = 1
        ", [$productId]);
    }

    // Otros productos con la misma foto (la copia de «Hacer propio» comparte la de la Matriz).
    public function qCountProductsWithImage($image, $exceptId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}product
            WHERE image = ?
                AND id <> ?
        ", [$image, $exceptId]);
    }

    // Productos, servicios y paquetes viven en la misma tabla.
    public function qCreateProduct($array) {
        return $this->qInsertInto('product', $array);
    }

    public function qUpdateProduct($array) {
        return $this->qUpdateIn('product', $array);
    }

    // -- Paquetes (product.kind = 'bundle' + product_recipe) --

    // separate_price = lo que costaria comprar sus componentes por separado.
    public function qListBundles($companyId, $branchId, $active) {
        return $this->qRows("
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.cost,
                p.sell_pos,
                p.in_catalog,
                p.category_id,
                IFNULL(p.active, 1) AS active,
                c.name AS category,
                (SELECT IFNULL(SUM(r.quantity * x.price), 0)
                   FROM {$this->pos}product_recipe r
                   INNER JOIN {$this->pos}product x ON x.id = r.component_id
                  WHERE r.product_id = p.id
                    AND IFNULL(r.active, 1) = 1) AS separate_price
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c ON c.id = p.category_id
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind = 'bundle'
                AND IFNULL(p.active, 1) = ?
            ORDER BY p.name
        ", [$companyId, $branchId, $active]);
    }

    public function qGetBundle($id, $companyId, $branchId) {
        return $this->qRow("
            SELECT
                id, name, description, price, cost,
                sell_pos, in_catalog, category_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE id = ?
                AND company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind = 'bundle'
            LIMIT 1
        ", [$id, $companyId, $branchId]);
    }

    // Componentes de varios paquetes en una sola consulta (la columna Contenido).
    // unit_cost / price = los del componente hoy; cost = lo guardado en la receta.
    public function qBundleItems(array $ids) {
        if (empty($ids)) return [];

        return $this->qRows("
            SELECT
                r.product_id,
                r.component_id,
                r.quantity,
                r.cost,
                x.name,
                x.kind,
                x.price,
                x.cost AS unit_cost,
                IFNULL(x.active, 1) AS active
            FROM {$this->pos}product_recipe r
            INNER JOIN {$this->pos}product x ON x.id = r.component_id
            WHERE r.product_id IN (" . $this->qIn($ids) . ")
                AND IFNULL(r.active, 1) = 1
            ORDER BY r.product_id, x.name
        ", array_values($ids));
    }

    // Lo que se puede meter a un paquete: productos y servicios activos de la sucursal.
    public function qComponentOptions($companyId, $branchId) {
        return $this->qRows("
            SELECT id, name AS valor, kind, price, cost
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind IN ('product', 'service')
                AND IFNULL(active, 1) = 1
            ORDER BY name
        ", [$companyId, $branchId]);
    }

    // Los mismos filtros que qComponentOptions: lo que no vuelve no es valido.
    public function qComponentsByIds($companyId, $branchId, array $ids) {
        if (empty($ids)) return [];

        return $this->qRows("
            SELECT id, name, kind, price, cost
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind IN ('product', 'service')
                AND IFNULL(active, 1) = 1
                AND id IN (" . $this->qIn($ids) . ")
        ", array_merge([$companyId, $branchId], array_values($ids)));
    }

    public function qCountBundles($companyId, $branchId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND kind = 'bundle'
                AND IFNULL(active, 1) = 1
        ", [$companyId, $branchId]);
    }

    // La receta se reescribe completa al guardar el paquete (dentro de transaction()).
    public function qDeleteBundleItems($bundleId) {
        return $this->_CUD("DELETE FROM {$this->pos}product_recipe WHERE product_id = ?", [$bundleId]);
    }

    public function qCreateBundleItem($array) {
        return $this->qInsertInto('product_recipe', $array);
    }

    // -- Grupos de modificadores (por empresa; NULL = plantilla) --

    public function qListModifierGroups($companyId, $active) {
        return $this->qRows("
            SELECT
                g.id,
                g.name,
                g.is_extra,
                g.company_id,
                IFNULL(g.active, 1) AS active,
                (SELECT COUNT(*) FROM {$this->pos}modifier m
                  WHERE m.modifier_group_id = g.id
                    AND IFNULL(m.active, 1) = 1) AS modifiers
            FROM {$this->pos}modifier_group g
            WHERE (g.company_id = ? OR g.company_id IS NULL)
                AND IFNULL(g.active, 1) = ?
            ORDER BY g.company_id IS NULL, g.name
        ", [$companyId, $active]);
    }

    public function qGetModifierGroup($id, $companyId) {
        return $this->qRow("
            SELECT id, name, is_extra, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}modifier_group
            WHERE id = ?
                AND (company_id = ? OR company_id IS NULL)
            LIMIT 1
        ", [$id, $companyId]);
    }

    // Contra todo lo que la empresa ve: los suyos y las plantillas.
    public function qFindModifierGroupByName($companyId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}modifier_group
            WHERE (company_id = ? OR company_id IS NULL)
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $name, $exceptId]);
    }

    public function qCountModifierGroups($companyId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}modifier_group
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
        ", [$companyId]);
    }

    // $ownOnly = solo los de la empresa (el modal de modificador: a una
    // plantilla no se le agregan opciones). $keepId se incluye aunque este inactivo.
    public function qModifierGroupOptions($companyId, $ownOnly = false, $keepId = 0) {
        $scope = $ownOnly ? 'company_id = ?' : '(company_id = ? OR company_id IS NULL)';

        return $this->qRows("
            SELECT id, name AS valor, company_id, is_extra
            FROM {$this->pos}modifier_group
            WHERE {$scope}
                AND (IFNULL(active, 1) = 1 OR id = ?)
            ORDER BY company_id IS NULL, name
        ", [$companyId, $keepId]);
    }

    public function qCreateModifierGroup($array) {
        return $this->qInsertInto('modifier_group', $array);
    }

    public function qUpdateModifierGroup($array) {
        return $this->qUpdateIn('modifier_group', $array);
    }

    // -- Modificadores (cuelgan de un grupo) --

    // INNER JOIN: un modificador sin grupo no tiene a que empresa pertenecer.
    public function qListModifiers($companyId, $active, $groupId = null) {
        $where = '';
        $data  = [$companyId, $active];

        if ($groupId !== null) {
            $where  = 'AND m.modifier_group_id = ?';
            $data[] = $groupId;
        }

        return $this->qRows("
            SELECT
                m.id,
                m.name,
                m.description,
                m.price,
                m.quantity,
                m.modifier_group_id,
                IFNULL(m.active, 1) AS active,
                g.name AS group_name,
                g.company_id AS group_company_id,
                g.is_extra,
                IFNULL(g.active, 1) AS group_active
            FROM {$this->pos}modifier m
            INNER JOIN {$this->pos}modifier_group g ON g.id = m.modifier_group_id
            WHERE (g.company_id = ? OR g.company_id IS NULL)
                AND IFNULL(m.active, 1) = ?
                {$where}
            ORDER BY g.company_id IS NULL, g.name, m.name
        ", $data);
    }

    public function qGetModifier($id, $companyId) {
        return $this->qRow("
            SELECT
                m.id,
                m.name,
                m.description,
                m.price,
                m.quantity,
                m.modifier_group_id,
                IFNULL(m.active, 1) AS active,
                g.company_id AS group_company_id
            FROM {$this->pos}modifier m
            INNER JOIN {$this->pos}modifier_group g ON g.id = m.modifier_group_id
            WHERE m.id = ?
                AND (g.company_id = ? OR g.company_id IS NULL)
            LIMIT 1
        ", [$id, $companyId]);
    }

    public function qFindModifierByName($groupId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, IFNULL(active, 1) AS active
            FROM {$this->pos}modifier
            WHERE modifier_group_id = ?
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$groupId, $name, $exceptId]);
    }

    public function qCountModifiers($companyId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}modifier m
            INNER JOIN {$this->pos}modifier_group g ON g.id = m.modifier_group_id
            WHERE (g.company_id = ? OR g.company_id IS NULL)
                AND IFNULL(m.active, 1) = 1
        ", [$companyId]);
    }

    public function qCreateModifier($array) {
        return $this->qInsertInto('modifier', $array);
    }

    public function qUpdateModifier($array) {
        return $this->qUpdateIn('modifier', $array);
    }

    // -- Metodos de pago (por empresa; NULL = plantilla) --

    public function qListPaymentMethods($companyId, $active) {
        return $this->qRows("
            SELECT
                id, name, code, kind, commission, sort,
                is_cash, is_visible, earns_points, company_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}payment_method
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = ?
            ORDER BY sort, name
        ", [$companyId, $active]);
    }

    public function qGetPaymentMethod($id, $companyId) {
        return $this->qRow("
            SELECT
                id, name, code, kind, commission, sort,
                is_cash, is_visible, earns_points, company_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}payment_method
            WHERE id = ?
                AND (company_id = ? OR company_id IS NULL)
            LIMIT 1
        ", [$id, $companyId]);
    }

    public function qFindPaymentMethodByName($companyId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}payment_method
            WHERE (company_id = ? OR company_id IS NULL)
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $name, $exceptId]);
    }

    public function qFindPaymentMethodByCode($companyId, $code, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}payment_method
            WHERE (company_id = ? OR company_id IS NULL)
                AND TRIM(code) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $code, $exceptId]);
    }

    public function qCountPaymentMethods($companyId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}payment_method
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
        ", [$companyId]);
    }

    public function qCreatePaymentMethod($array) {
        return $this->qInsertInto('payment_method', $array);
    }

    public function qUpdatePaymentMethod($array) {
        return $this->qUpdateIn('payment_method', $array);
    }

    // -- Descuentos: motivos de descuento (por empresa; NULL = plantilla) --

    public function qListDiscounts($companyId, $active) {
        return $this->qRows("
            SELECT
                id, code, name, max_percent, requires_authorization, company_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}discount_reason
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = ?
            ORDER BY company_id IS NULL, name
        ", [$companyId, $active]);
    }

    public function qGetDiscount($id, $companyId) {
        return $this->qRow("
            SELECT
                id, code, name, max_percent, requires_authorization, company_id,
                IFNULL(active, 1) AS active
            FROM {$this->pos}discount_reason
            WHERE id = ?
                AND (company_id = ? OR company_id IS NULL)
            LIMIT 1
        ", [$id, $companyId]);
    }

    public function qFindDiscountByName($companyId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}discount_reason
            WHERE (company_id = ? OR company_id IS NULL)
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $name, $exceptId]);
    }

    public function qFindDiscountByCode($companyId, $code, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, company_id, IFNULL(active, 1) AS active
            FROM {$this->pos}discount_reason
            WHERE (company_id = ? OR company_id IS NULL)
                AND TRIM(code) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $code, $exceptId]);
    }

    public function qCountDiscounts($companyId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}discount_reason
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
        ", [$companyId]);
    }

    public function qCreateDiscount($array) {
        return $this->qInsertInto('discount_reason', $array);
    }

    public function qUpdateDiscount($array) {
        return $this->qUpdateIn('discount_reason', $array);
    }
}
