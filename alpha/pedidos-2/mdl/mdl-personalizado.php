<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    // PEDIDOS PERSONALIZADOS --------------------------------
    public function getByIdCustomOrder($array) {
        return $this->_Select([
            'table' => "{$this->bd}order_custom",
            'values' => "*",
            'where' => "id = ?",
            'data' => $array
        ])[0];
    }

    function createCustomOrder($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_custom",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateCustomOrder($array){
        return $this->_Update([
            'table'  => "{$this->bd}order_custom",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function deleteCustomOrder($array){
        return $this->_Delete([
            'table' => "{$this->bd}order_custom",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function maxCustomOrder(){
        return $this->_Select([
            'table' => "{$this->bd}order_custom",
            'values' => "MAX(id) as max_id",
        ])[0]['max_id'];
    }

    // ORDEN PAQUETE -----------------------------------------
    // Agregar a la orden el pastel personalizado.
    function createOrderPackage($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // Actualizar orden paquete.
    function updateOrderPackage($array){
        return $this->_Update([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Obtener el último id de orden paquete.
    function maxOrderPackage(){
        return $this->_Select([
            'table' => "{$this->bd}order_package",
            'values' => "MAX(id) as max_id",
        ])[0]['max_id'];
    }

    // PRODUCTOS DE MODIFICADOR ------------------------------
    // Crear producto de modificador.
    function createOrderModifierProduct($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // Obtener el último id de producto de modificador.
    function maxOrderModifierProduct(){
        return $this->_Select([
            'table' => "{$this->bd}order_modifier_products",
            'values' => "MAX(id) as max_id",
        ])[0]['max_id'];
    }

    // PRODUCTOS EN EL PEDIDO PERSONALIZADO -----------------
    // Agregar producto al pedido personalizado
    function createProductInOrderCustom($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_custom_products",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    //IMÁGENES ----------------------------------------------
    function createOrderImages($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_images",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // Obtener order_package por ID
    function getOrderPackageById($array){
        $row = $this->_Select([
            'table'  => "{$this->bd}order_package",
            'values' => "*",
            'where'  => "id = ?",
            'data'   => $array
        ]);
        return !empty($row[0]) ? $row[0] : null;
    }

    // Obtener productos del pedido personalizado
    function getProductsInOrderCustom($array){
        return $this->_Select([
            'table'  => "{$this->bd}order_custom_products",
            'values' => "*",
            'where'  => "custom_id = ?",
            'data'   => $array
        ]);
    }

    // Eliminar productos del pedido personalizado
    function deleteProductsInOrderCustom($array){
        return $this->_Delete([
            'table' => "{$this->bd}order_custom_products",
            'where' => "custom_id",
            'data'  => $array
        ]);
    }

    // Obtener imágenes por ID de order_package
    function getImagesByOrderPackageId($array){
        return $this->_Select([
            'table'  => "{$this->bd}order_images",
            'values' => "*",
            'where'  => "package_id = ?",
            'data'   => $array
        ]);
    }

    // Obtener imagen por ID
    function getImageById($array){
        $result = $this->_Select([
            'table'  => "{$this->bd}order_images",
            'values' => "*",
            'where'  => "id = ?",
            'data'   => $array
        ]);
        return !empty($result[0]) ? $result[0] : null;
    }

    // Eliminar imagen por ID
    function deleteImageById($array){
        $query = "
            DELETE FROM {$this->bd}order_images
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }


    // Pedidos.
      public function getOrderById($array) {
        // $sql = "
        //     SELECT
        //         order_package.id as id,
        //         order_products.`name` as name,
        //         order_products.price,
        //         order_package.quantity,
        //         order_package.order_details,
        //         order_products.description,
        //         order_package.dedication,
        //         order_products.image,
        //         order_package.custom_id,
        //         order_custom.name as custom_name,
        //         order_custom.price as custom_price,
        //         order_custom.price_real as custom_price_real,
        //         order_custom.portion_qty as custom_portion_qty
        //     FROM
        //         {$this->bd}order_package
        //     INNER JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
        //     LEFT JOIN {$this->bd}order_custom ON order_package.custom_id = order_custom.id
        //     WHERE pedidos_id = ?
        // ";

         $sql = "
            SELECT
                order_package.id,
                -- 🔹 Si existe un producto normal, toma su nombre; si no, toma el del personalizado
                COALESCE(order_products.name, order_custom.name) AS name,

                -- 🔹 Igual para el precio
                COALESCE(order_products.price, order_custom.price_real) AS price,

                -- 🔹 Cantidad siempre viene de order_package
                order_package.quantity,

                order_package.order_details,
                order_package.dedication,
                order_package.product_id,
                order_package.custom_id,
                order_custom.portion_qty,

                -- 🔹 Descripción e imagen, solo si existe en el producto o en el personalizado
                COALESCE(order_products.description, order_custom.description) AS description,
                COALESCE(order_products.image, order_custom.image) AS image

            FROM
                {$this->bd}order_package
            LEFT JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
            LEFT JOIN {$this->bd}order_custom   ON order_package.custom_id  = order_custom.id
            WHERE
                order_package.pedidos_id = ?
        ";
        
        $products = $this->_Read($sql, $array);
        
        foreach ($products as &$product) {

            $product['images'] = $this->getOrderImg([$product['id']]);
            
            if (!empty($product['custom_id'])) {

                $product['is_custom'] = true;
                
                // Obtener productos personalizados (modificadores)
                $product['customer_products'] = $this->getCustomProduct([$product['custom_id']]);
                
                if (!empty($product['custom_price_real'])) {
                    $product['price'] = $product['custom_price_real'];
                } else if (!empty($product['custom_price'])) {
                    $product['price'] = $product['custom_price'];
                }
                
                if (!empty($product['custom_name'])) {
                    $product['name'] = $product['custom_name'];
                }
            } else {
                $product['is_custom'] = false;
                $product['customer_products'] = [];
            }
        }
        unset($product);
        
        return $products;
    }

     function getCustomProduct($array) {
        $query = "
        SELECT
                ocp.id,
                ocp.price AS custom_price,
                ocp.quantity AS custom_quantity,
                ocp.details,
                omp.`name`,
                omp.price,
                omp.description,
                order_modifier.`name` as modifier_name,
                order_modifier.isExtra
                FROM
                {$this->bd}order_custom_products AS ocp
                INNER JOIN {$this->bd}order_modifier_products AS omp ON ocp.modifier_id = omp.id
                INNER JOIN {$this->bd}order_modifier ON omp.modifier_id = order_modifier.id
            WHERE
                ocp.custom_id = ?
            ORDER BY
                ocp.id ASC
        ";
        
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

     function getOrderImg($array){

        $query =
        "
        SELECT
            order_images.id,
            order_images.path,
            order_images.name,
            order_images.original_name,
            order_images.package_id
        FROM {$this->bd}order_images
        WHERE package_id = ?

        ";

        return $this->_Read($query, $array);

    }

    function updateOrder($array){
        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }




}
?>
